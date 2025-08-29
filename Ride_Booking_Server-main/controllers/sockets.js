import geolib from "geolib";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Ride from "../models/Ride.js";

const onDutyRiders = new Map(); // key: userId -> { socketId, coords, vehicle }

// in-memory map of pending offer timers: rideId -> Timeout
const pendingOfferTimers = new Map();

function clearPendingTimerForRide(rideId) {
  try {
    const id = String(rideId);
    if (pendingOfferTimers.has(id)) {
      clearTimeout(pendingOfferTimers.get(id));
      pendingOfferTimers.delete(id);
      console.log('[sockets] cleared pendingOfferTimer for ride', id);
    }
  } catch (e) { /* ignore */ }
}


const generateOtp = () => {
  return Math.floor(1000 + Math.random() * 9000).toString()
}
const handleSocketConnection = (io) => {
  // auth middleware
  io.use(async (socket, next) => {
    try {
      const authTokenFromAuth = socket.handshake?.auth?.token;
      const authTokenFromHeader = socket.handshake?.headers?.access_token || socket.handshake?.headers?.authorization;
      let token = authTokenFromAuth || authTokenFromHeader || null;

      // if header is Bearer <token>, extract the token
      if (typeof token === 'string' && token.toLowerCase().startsWith('bearer ')) {
        token = token.split(/\s+/)[1];
      }

      console.log('[sockets] incoming socket auth token present:', !!token, 'authFromAuth:', !!authTokenFromAuth, 'authFromHeader:', !!authTokenFromHeader);

      if (!token) {
        console.warn('[sockets] auth missing token on socket handshake for socket', socket.id);
        return next(new Error('Authentication invalid: No token provided'));
      }

      // verify token
      let payload;
      try {
        payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        console.log('[sockets] token verified payload keys:', Object.keys(payload || {}));
      } catch (err) {
        console.error('[sockets] token verify failed', err);
        return next(new Error('Authentication invalid: token verify failed'));
      }

      // acceptable id fields: id, _id, userId
      const userId = payload?.id || payload?._id || payload?.userId;
      if (!userId) {
        console.warn('[sockets] token payload missing user id fields', payload);
        return next(new Error('Authentication invalid: payload missing id'));
      }

      const user = await User.findById(userId);
      if (!user) {
        console.warn('[sockets] auth user not found', userId);
        return next(new Error('Authentication invalid: user not found'));
      }

      socket.user = { id: user._id.toString(), role: user.role, raw: user };
      console.log('[sockets] authenticated socket', socket.id, 'user', socket.user.id, 'role', socket.user.role);
      return next();
    } catch (err) {
      console.error('[sockets] auth middleware error', err);
      return next(new Error('Authentication invalid'));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    console.log(`[sockets] client connected socket=${socket.id} userId=${user?.id} role=${user?.role}`);

    // ----- RIDER HANDLERS -----
    if (user.role === "rider") {
      // go on duty: register rider with coords (and preserve previous vehicle if set)
      socket.on("goOnDuty", (coords = null) => {
        const existing = onDutyRiders.get(user.id) || {};
        const entry = { socketId: socket.id, coords: coords || existing.coords || null, vehicle: existing.vehicle || null };
        onDutyRiders.set(user.id, entry);
        socket.join("onDuty");
        console.log(`[sockets] rider ${user.id} goOnDuty socket=${socket.id} coords=${JSON.stringify(entry.coords)} vehicle=${entry.vehicle}`);
        updateNearbyriders();
      });
      socket.on('customer:accept_offer', async (payload) => {
        try {
          console.log('[sockets] customer:accept_offer received from', socket.id, 'payload:', payload);
          const customerId = socket.user?.id;
          const { rideId, riderId } = payload || {};
          if (!rideId || !riderId) {
            console.warn('[sockets] customer:accept_offer missing rideId or riderId', payload);
            return socket.emit('error', { message: 'Missing rideId or riderId' });
          }

          // update ride: assign rider and mark as ARRIVING
          const updated = await Ride.findByIdAndUpdate(
            rideId,
            {
              $set: {
                rider: riderId,
                status: 'ARRIVING',
                acceptedByCustomerAt: new Date()
              }
            },
            { new: true }
          ).populate('rider customer').lean().exec();

          if (!updated) {
            console.warn('[sockets] customer:accept_offer ride not found', rideId);
            return socket.emit('error', { message: 'Ride not found' });
          }

          console.log('[sockets] customer:accept_offer updated ride', rideId, 'status ->', updated.status);

          // emit updated ride to any listeners subscribed to ride room
          console.log('[sockets] emitting rideData to room ride:' + rideId, updated);
          io.to(`ride:${rideId}`).emit('rideData', { ride: updated });
          console.log('[sockets] emitted rideData to room ride:' + rideId);

          // notify customer socket who accepted (ack)
          io.to(socket.id).emit('ride:accepted:ack', { ride: updated });
          console.log('[sockets] sent ride:accepted:ack to customer', socket.id);

          // notify the chosen rider (if onDuty map has socketId) via helper getRiderSocket (defined below in this file)
          try {
            const riderSocketInstance = getRiderSocket(riderId); // helper in this file returns socket instance or null
            if (riderSocketInstance) {
              riderSocketInstance.emit('ride:assigned', { ride: updated, byCustomer: customerId });
              console.log('[sockets] notified rider', riderId, 'socket', riderSocketInstance.id, 'about assignment');
            } else {
              console.log('[sockets] rider socket not found for riderId', riderId);
            }
          } catch (err) {
            console.warn('[sockets] notify rider failed', err);
          }
        } catch (err) {
          console.error('[sockets] customer:accept_offer error', err);
          socket.emit('error', { message: 'Failed to accept offer', error: err?.message });
        }
      });

      // go off duty: remove from map & leave rooms
      socket.on("goOffDuty", () => {
        onDutyRiders.delete(user.id);
        socket.leave("onDuty");
        if (socket.vehicle) {
          socket.leave(`riders:${socket.vehicle}`);
          console.log(`[sockets] rider ${user.id} left room riders:${socket.vehicle}`);
          socket.vehicle = null;
        }
        console.log(`[sockets] rider ${user.id} goOffDuty removed`);
        updateNearbyriders();
      });

      // update location: update map and notify customers
      socket.on("updateLocation", (coords) => {
        if (onDutyRiders.has(user.id)) {
          const entry = onDutyRiders.get(user.id);
          entry.coords = coords;
          entry.socketId = socket.id;
          onDutyRiders.set(user.id, entry);
          console.log(`[sockets] rider ${user.id} updateLocation`, coords);
          updateNearbyriders();
          socket.to(`rider_${user.id}`).emit("riderLocationUpdate", { riderId: user.id, coords });
        }
      });
      // socket.on('offer:accept', async (payload) => {
      //   console.log('[sockets] offer:accept received from', socket.id, 'payload=', payload)
      //   try {
      //     console.log('[sockets] offer:accept', payload, 'from', socket.id)
      //     const { rideId, riderId, price } = payload || {}
      //     if (!rideId || !riderId) return socket.emit('error', { message: 'Missing rideId or riderId in offer accept' })
      //     // generate OTP and log it
      //     const otp = generateOtp()
      //     console.log('[sockets] generated OTP', otp, 'for ride', rideId)
      //     // assign rider and mark ARRIVING
      //     const updated = await Ride.findByIdAndUpdate(
      //       rideId,
      //       {
      //         $set: {
      //           rider: riderId,
      //           status: 'ARRIVING',
      //           otp,
      //           acceptedOffer: { rider: riderId, price, acceptedAt: new Date() }
      //         }
      //       },
      //       { new: true }
      //     ).populate('rider customer').lean().exec()

      //     if (!updated) return socket.emit('error', { message: 'Ride not found' })
      //     console.log('[sockets] offer:accept updated ride', updated._id, 'status->', updated.status)
      //     // notify room and customer
      //     console.log('[sockets] emitting rideData to room ride:' + rideId, updated);
      //     io.to(`ride:${rideId}`).emit('rideData', { ride: updated })
      //     console.log('[sockets] emitted rideData to room ride:' + rideId)
      //     if (payload.customerSocketId) {
      //       io.to(payload.customerSocketId).emit('ride:accepted', { ride: updated })
      //       console.log('[sockets] emitted ride:accepted to customer socket', payload.customerSocketId)
      //     }
      //     // ack to rider
      //     io.to(socket.id).emit('offer:accepted:ack', { ride: updated })
      //     console.log('[sockets] sent offer:accepted:ack to rider socket', socket.id)
      //     console.log('[sockets] offer accepted -> ARRIVING', rideId)
      //   } catch (err) {
      //     console.error('[sockets] offer:accept error', err)
      //     socket.emit('error', { message: 'Failed to accept offer' })
      //   }
      // })
      socket.on('offer:accept', async (payload) => {
        try {
          console.log('[sockets] offer:accept payload', payload)
          const { rideId, riderId, price } = payload || {}
          if (!rideId || !riderId) {
            console.warn('[sockets] offer:accept missing rideId or riderId', payload)
            return socket.emit('error', { message: 'Missing rideId or riderId' })
          }

          // generate OTP and update ride: assign rider and mark ARRIVING
          const otp = generateOtp()
          const updated = await Ride.findByIdAndUpdate(
            rideId,
            {
              $set: {
                rider: riderId,
                status: 'ARRIVING',
                otp,
                acceptedOffer: { rider: riderId, price: Number(price || 0), acceptedAt: new Date() }
              }
            },
            { new: true }
          ).populate('rider customer').lean().exec()

          if (!updated) {
            console.warn('[sockets] offer:accept ride not found', rideId)
            return socket.emit('error', { message: 'Ride not found' })
          }

          console.log('[sockets] offer:accept updated ride', updated._id, 'status->', updated.status)
          try { clearPendingTimerForRide(rideId) } catch (e) { /* ignore */ }
          // Broadcast updated ride to anyone subscribed to the ride room
          io.to(`ride:${rideId}`).emit('rideData', { ride: updated })
          console.log('[sockets] emitted rideData to room ride:' + rideId)

          // Notify customer directly if customerSocketId provided in payload
          if (payload?.customerSocketId) {
            io.to(payload.customerSocketId).emit('ride:accepted', { ride: updated })
            console.log('[sockets] emitted ride:accepted to customer socket', payload.customerSocketId)
          }

          // Notify the chosen rider using onDuty map helper
          try {
            const riderSocketInstance = getRiderSocket(riderId)
            if (riderSocketInstance) {
              riderSocketInstance.emit('ride:accepted', { ride: updated, byRider: riderId })
              console.log('[sockets] emitted ride:accepted to rider', riderId, 'socket', riderSocketInstance.id)
            } else {
              console.log('[sockets] rider socket not found for riderId', riderId)
            }
          } catch (err) {
            console.warn('[sockets] notify rider failed', err)
          }

          // Acknowledge origin (rider) who sent offer:accept
          io.to(socket.id).emit('offer:accepted', { ride: updated })
          console.log('[sockets] confirmed offer:accepted to origin socket', socket.id, 'ride', updated._id)
        } catch (err) {
          console.error('[sockets] offer:accept error', err)
            + socket.emit('error', { message: 'Failed to accept offer', error: err?.message || String(err) })
        }
      })

      // rider selects which vehicle they will use (bike/auto/cab etc.)
      socket.on("rider:setVehicle", (vehicle) => {
        try {
          const prev = socket.vehicle;
          if (prev && prev !== vehicle) {
            socket.leave(`riders:${prev}`);
            console.log(`[sockets] rider ${user.id} leaving room riders:${prev}`);
          }
          socket.vehicle = vehicle;
          socket.join(`riders:${vehicle}`);
          const existing = onDutyRiders.get(user.id) || {};
          onDutyRiders.set(user.id, { socketId: socket.id, coords: existing.coords || null, vehicle });
          console.log(`[sockets] rider:setVehicle user=${user.id} socket=${socket.id} vehicle=${vehicle} joined room riders:${vehicle}`);
          updateNearbyriders();
        } catch (err) {
          console.error("[sockets] rider:setVehicle error", err);
        }
      });
    }

    // ----- CUSTOMER HANDLERS -----
    if (user.role === "customer") {
      socket.on("subscribeToZone", (customerCoords) => {
        socket.user.coords = customerCoords;
        console.log(`[sockets] customer ${user.id} subscribeToZone`, customerCoords);
        sendNearbyRiders(socket, customerCoords);
      });

      // legacy search flow (keeps compatibility)
      socket.on("searchrider", async (rideId) => {
        try {
          const ride = await Ride.findById(rideId).populate("customer rider");
          if (!ride) return socket.emit("error", { message: "Ride not found" });
          console.log(`[sockets] customer ${user.id} searchrider for ride ${rideId}`);
          const { latitude: pickupLat, longitude: pickupLon } = ride.pickup;

          let retries = 0;
          let rideAccepted = false;
          let canceled = false;
          const MAX_RETRIES = 20;

          const retrySearch = async () => {
            if (canceled) return;
            retries++;
            const riders = sendNearbyRiders(socket, { latitude: pickupLat, longitude: pickupLon }, ride);
            if (riders.length > 0 || retries >= MAX_RETRIES) {
              clearInterval(retryInterval);
              if (!rideAccepted && retries >= MAX_RETRIES) {
                await Ride.findByIdAndDelete(rideId);
                socket.emit("error", { message: "No riders found within 5 minutes." });
              }
            }
          };

          const retryInterval = setInterval(retrySearch, 10000);

          socket.on("rideAccepted", () => {
            rideAccepted = true;
            clearInterval(retryInterval);
          });

          socket.on("cancelRide", async () => {
            canceled = true;
            clearInterval(retryInterval);
            try { clearPendingTimerForRide(rideId) } catch (e) { }
            await Ride.findByIdAndDelete(rideId);
            socket.emit("rideCanceled", { message: "Ride canceled" });
            if (ride.rider) {
              const riderSocket = getRiderSocket(ride.rider._id);
              riderSocket?.emit("rideCanceled", { message: `Customer ${user.id} canceled the ride.` });
            }
            console.log(`Customer ${user.id} canceled ride ${rideId}`);
          });
        } catch (error) {
          console.error("[sockets] searchrider error", error);
          socket.emit("error", { message: "Error searching for rider" });
        }
      });
    }

    // Subscribe to a specific rider's live location updates
    socket.on("subscribeToriderLocation", (riderId) => {
      const rider = onDutyRiders.get(riderId);
      if (rider) {
        socket.join(`rider_${riderId}`);
        socket.emit("riderLocationUpdate", { riderId, coords: rider.coords });
        console.log(`[sockets] user ${user.id} subscribed to rider ${riderId} location`);
      }
    });

    // // Subscribe to a specific ride: join room and emit current ride data
    // socket.on("subscribeRide", async (rideId) => {
    //   try {
    //     console.log('[sockets] subscribeRide', { socketId: socket.id, rideId });
    //     socket.join(`ride:${rideId}`);
    //     const ride = await Ride.findById(rideId).populate("customer rider").lean().exec();
    //     if (ride) {
    //       socket.emit("rideData", { ride });
    //       console.log('[sockets] emitted rideData to', socket.id, rideId);
    //     } else {
    //       socket.emit("error", { message: "Ride not found", rideId });
    //     }
    //   } catch (err) {
    //     console.error('[sockets] subscribeRide error', err);
    //     socket.emit("error", { message: "Failed to subscribe ride", error: err.message });
    //   }
    // });
    // Subscribe to a specific ride: join room and emit current ride data
    socket.on("subscribeRide", async (payload) => {
      try {
        // support both: emit('subscribeRide', rideId) and emit('subscribeRide', { rideId })
        const rid = payload?.rideId ?? payload;
        console.log('[sockets] subscribeRide payload', { socketId: socket.id, payload, resolvedRideId: rid });
        if (!rid) {
          socket.emit('error', { message: 'subscribeRide missing rideId', payload });
          return;
        }
        socket.join(`ride:${rid}`);
        const ride = await Ride.findById(String(rid)).populate("customer rider").lean().exec();
        if (ride) {
          socket.emit("rideData", { ride });
          console.log('[sockets] emitted rideData to', socket.id, rid);
        } else {
          socket.emit("error", { message: "Ride not found", rideId: rid });
        }
      } catch (err) {
        console.error('[sockets] subscribeRide error', err);
        socket.emit("error", { message: "Failed to subscribe ride", error: err?.message || String(err) });
      }
    });

    // Customer requests server to broadcast a search to riders for the ride's vehicle type
    // socket.on("searchRide", async (rideId) => {
    //   // try {
    //   //   console.log('[sockets] searchRide request from', socket.id, 'rideId=', rideId);
    //   //   const ride = await Ride.findById(rideId).lean().exec();
    //   //   if (!ride) {
    //   //     console.warn('[sockets] searchRide ride not found', rideId);
    //   //     return;
    //   //   }
    //   //   const room = `riders:${ride.vehicle}`;
    //   //   const payload = { rideId, ride, customerSocketId: socket.id };
    //   //   io.to(room).emit("ride:new_request", payload);
    //   //   console.log('[sockets] emitted ride:new_request to room', room, 'for ride', rideId);
    //   // }
    //   try {
    //     const rid = String(ride._id || rideId);
    //     console.log('[sockets] start auto-cancel setup for ride', rid, 'pendingBefore=', pendingOfferTimers.size);
    //     clearPendingTimerForRide(rid);
    //     const t = setTimeout(async () => {
    //       console.log('[sockets] auto-cancel timeout fired for ride', rid);
    //       try {
    //         const current = await Ride.findById(rid).lean().exec();
    //         if (!current) return;
    //         const hasRider = !!current.rider;
    //         const status = String(current.status || '').toUpperCase();
    //         console.log('[sockets] auto-cancel check', rid, { hasRider, status });
    //         if (!hasRider && status === 'SEARCHING_FOR_RIDER') {
    //           const updated = await Ride.findByIdAndUpdate(
    //             rid,
    //             { $set: { status: 'No RIDER ALLOTED', rider: null } },
    //             { new: true }
    //           ).lean().exec();
    //           console.log('[sockets] auto-cancel: no rider allotted for ride', rid);
    //           try { io.to(socket.id).emit('ride:no_rider', { ride: updated }) } catch (e) { console.warn('[sockets] emit ride:no_rider failed', e) }
    //           try { io.to(`ride:${rid}`).emit('rideData', { ride: updated }) } catch (e) { console.warn('[sockets] emit rideData failed', e) }
    //         } else {
    //           console.log('[sockets] auto-cancel skipped for ride', rid, 'hasRider=', hasRider, 'status=', status);
    //         }
    //       } catch (err) {
    //         console.warn('[sockets] auto-cancel error', err);
    //       } finally {
    //         pendingOfferTimers.delete(rid);
    //         console.log('[sockets] pendingOfferTimers size after delete=', pendingOfferTimers.size);
    //       }
    //     }, 5 * 1000);
    //     pendingOfferTimers.set(rid, t);
    //     console.log('[sockets] started auto-cancel timer for ride', rid, 'pendingAfter=', pendingOfferTimers.size);
    //   } catch (e) { console.warn('[sockets] start auto-cancel timer failed', e) }
    // });
    socket.on("searchRide", async (rideId) => {
      try {
        console.log('[sockets] searchRide request from', socket.id, 'rideId=', rideId);
        const ride = await Ride.findById(rideId).lean().exec();
        if (!ride) {
          console.warn('[sockets] searchRide ride not found', rideId);
          return;
        }

        const room = `riders:${ride.vehicle}`;
        // const payload = { rideId, ride, customerSocketId: socket.id };
        const customerSocketId = socket.id; // capture for timer closure
        const payload = { rideId, ride, customerSocketId };
        try {
          const socketsInRoom = await io.in(room).allSockets();
          const socketsArray = Array.from(socketsInRoom || []);
          console.log('[sockets] room', room, 'socketCount=', socketsArray.length, 'sockets=', socketsArray);
          if ((socketsArray.length || 0) > 0) {
            io.to(room).emit("ride:new_request", payload);
            console.log('[sockets] emitted ride:new_request to room', room, 'for ride', rideId);
          } else {
            const pickup = { latitude: ride.pickup?.latitude, longitude: ride.pickup?.longitude };
            console.log('[sockets] room', room, 'is empty -> using sendNearbyRiders fallback (10km)');
            const nearby = sendNearbyRiders(socket, pickup, ride, 10000);
            console.log('[sockets] fallback sendNearbyRiders sent count=', nearby.length, 'for ride', rideId);
          }
        } catch (err) {
          console.warn('[sockets] searchRide room check failed, emitting anyway', err);
          io.to(room).emit("ride:new_request", payload);
        }

        // start auto-cancel timer: if no rider accepts within 60s, mark NO RIDER ALLOTED
        try {
          const rid = String(ride._id || rideId);
          clearPendingTimerForRide(rid);
          const t = setTimeout(async () => {
            console.log('[sockets] auto-cancel timeout fired for ride', rid);
            try {
              const current = await Ride.findById(rid).lean().exec();
              if (!current) return;
              const hasRider = !!current.rider;
              const status = String(current.status || '').toUpperCase();
              console.log('[sockets] auto-cancel check', rid, { hasRider, status });
              if (!hasRider && status === 'SEARCHING_FOR_RIDER') {
                // const updated = await Ride.findByIdAndUpdate(
                //   rid,
                //   { $set: { status: 'No RIDER ALLOTED', rider: null } },
                //   { new: true }
                // ).lean().exec();
                // console.log('[sockets] auto-cancel: no rider allotted for ride', rid);
                // try { io.to(socket.id).emit('ride:no_rider', { ride: updated }) } catch (e) { console.warn('[sockets] emit ride:no_rider failed', e) }
                // try { io.to(`ride:${rid}`).emit('rideData', { ride: updated }) } catch (e) { console.warn('[sockets] emit rideData failed', e) }
                try {
                  const updated = await Ride.findOneAndUpdate(
                    { _id: rid, rider: null, status: 'SEARCHING_FOR_RIDER' }, // atomic precondition
                    { $set: { status: 'No_RIDER_ALLOTED', rider: null } },
                    { new: true }
                  ).lean().exec();

                  if (updated) {
                    console.log('[sockets] auto-cancel: No_RIDER_ALLOTED for ride', rid);
                    try { io.to(customerSocketId).emit('ride:no_rider', { ride: updated }) } catch (e) { console.warn('[sockets] emit ride:no_rider failed', e) }
                    try { io.to(`ride:${rid}`).emit('rideData', { ride: updated }) } catch (e) { console.warn('[sockets] emit rideData failed', e) }
                  } else {
                    console.log('[sockets] auto-cancel skipped — ride changed before update', rid);
                  }
                } catch (e) {
                  console.warn('[sockets] auto-cancel emit failed', e)
                }
              } else {
                console.log('[sockets] auto-cancel skipped for ride', rid, 'hasRider=', hasRider, 'status=', status);
              }
            } catch (err) {
              console.warn('[sockets] auto-cancel error', err);
            } finally {
              pendingOfferTimers.delete(rid);
              console.log('[sockets] pendingOfferTimers size after delete=', pendingOfferTimers.size);
            }
          }, 60 * 1000);
          pendingOfferTimers.set(rid, t);
          console.log('[sockets] started auto-cancel timer for ride', rid, 'pendingAfter=', pendingOfferTimers.size);
        } catch (e) { console.warn('[sockets] start auto-cancel timer failed', e) }
      } catch (err) {
        console.error('[sockets] searchRide error', err);
      }
    });

    socket.on('customer:cancel', async (payload) => {
      console.log('[sockets] received customer:cancel', { fromSocket: socket.id, payload })
      try {
        const rideId = payload?.rideId ?? payload
        if (!rideId) {
          socket.emit('error', { message: 'customer:cancel missing rideId' })
          return
        }
        console.log('[sockets] customer:cancel received', { socketId: socket.id, rideId })

        // clear any pending auto-offer timer
        try { clearPendingTimerForRide(String(rideId)) } catch (e) { /* ignore */ }

        // atomically update status unless already completed/cancelled
        const updated = await Ride.findOneAndUpdate(
          { _id: String(rideId), status: { $nin: ['COMPLETED', 'RIDE_CANCELLED_BY_CUSTOMER', 'RIDE_CANCELLED_BY_RIDER', 'CANCELLED'] } },
          { $set: { status: 'RIDE_CANCELLED_BY_CUSTOMER' } },
          { new: true }
        ).lean().exec()

        if (!updated) {
          console.log('[sockets] customer:cancel no update (ride missing or already final)', rideId)
          socket.emit('error', { message: 'Ride not cancelled (already final or not found)', rideId })
          return
        }

        console.log('[sockets] ride marked RIDE_CANCELLED_BY_CUSTOMER', rideId)

        // notify the customer socket
        try { socket.emit('ride:cancelled', { ride: updated }) } catch (e) { console.warn('[sockets] emit to customer failed', e) }

        // notify any subscribers (rider room / other sockets subscribed to this ride)
        try { io.to(`ride:${String(rideId)}`).emit('ride:cancelled', { ride: updated }) } catch (e) { console.warn('[sockets] emit ride:cancelled room failed', e) }
        try { io.to(`ride:${String(rideId)}`).emit('rideData', { ride: updated }) } catch (e) { console.warn('[sockets] emit rideData room failed', e) }
      } catch (err) {
        console.warn('[sockets] customer:cancel handler failed', err)
        try { socket.emit('error', { message: 'Failed to cancel ride', error: err?.message || String(err) }) } catch (e) { }
      }
    })


    // Rider sends offer back to a customer; server forwards to customer socket
    socket.on("offer:send", (offer) => {
      try {
        console.log('[sockets] offer:send from', socket.id, 'offer:', JSON.stringify(offer));
        if (offer?.customerSocketId) {
          io.to(offer.customerSocketId).emit("ride:offer", { ...offer, fromSocket: socket.id });
          console.log('[sockets] forwarded offer to customer', offer.customerSocketId);
        } else {
          console.warn('[sockets] offer missing customerSocketId', offer);
        }
      } catch (err) {
        console.error('[sockets] offer:send error', err);
      }
    });

    // cleanup on disconnect
    socket.on("disconnect", () => {
      try {
        if (user.role === "rider") {
          onDutyRiders.delete(user.id);
          console.log(`[sockets] rider ${user.id} removed from onDuty on disconnect socket=${socket.id}`);
        }
        // ensure leaving any vehicle rooms is handled by socket.io automatically on disconnect
        console.log(`[sockets] client disconnected socket=${socket.id} user=${user.id}`);
      } catch (e) {
        console.warn('[sockets] disconnect cleanup error', e);
      }
    });

    // ---------- helper functions ----------
    function updateNearbyriders() {
      console.log('[sockets] updateNearbyriders broadcasting to customers');
      io.sockets.sockets.forEach((s) => {
        if (s.user?.role === "customer") {
          const customerCoords = s.user.coords;
          if (customerCoords) sendNearbyRiders(s, customerCoords);
        }
      });
    }

    function sendNearbyRiders(socketInstance, location, ride = null) {
      const nearbyriders = Array.from(onDutyRiders.entries())
        .map(([userId, rider]) => ({
          userId,
          socketId: rider.socketId,
          coords: rider.coords,
          vehicle: rider.vehicle,
          distance: rider.coords ? geolib.getDistance(rider.coords, location) : Infinity
        }))
        .filter((r) => r.distance <= 60000) // within 60km (adjust)
        .sort((a, b) => a.distance - b.distance);

      socketInstance.emit("nearbyRiders", nearbyriders.map(r => ({
        id: r.socketId,
        coords: r.coords,
        vehicle: r.vehicle,
        distance: r.distance
      })));

      if (ride) {
        // send rideOffer only to these nearby riders (we still rely on vehicle room logic for targeted broadcast)
        nearbyriders.forEach((r) => {
          io.to(r.socketId).emit("rideOffer", ride);
          console.log('[sockets] emitted rideOffer to rider socket', r.socketId);
        });
      }

      return nearbyriders;
    }

    function getRiderSocket(riderId) {
      const rider = onDutyRiders.get(riderId);
      return rider ? io.sockets.sockets.get(rider.socketId) : null;
    }
  });
};

export default handleSocketConnection;