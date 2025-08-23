// import geolib from "geolib";
// import jwt from "jsonwebtoken";
// import User from "../models/User.js";
// import Ride from "../models/Ride.js";

// const onDutyRiders = new Map();

// const handleSocketConnection = (io) => {
//   io.use(async (socket, next) => {
//     try {
//       const token = socket.handshake.headers.access_token;
//       if (!token) return next(new Error("Authentication invalid: No token"));

//       const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
//       const user = await User.findById(payload.id);
//       if (!user) return next(new Error("Authentication invalid: User not found"));

//       socket.user = { id: payload.id, role: user.role };
//       next();
//     } catch (error) {
//       console.error("Socket Auth Error:", error);
//       next(new Error("Authentication invalid: Token verification failed"));
//     }
//   });

//   io.on("connection", (socket) => {
//     const user = socket.user;
//     console.log(`User Joined: ${user.id} (${user.role})`);

//     if (user.role === "rider") {
//       socket.on("goOnDuty", (coords) => {
//         onDutyRiders.set(user.id, { socketId: socket.id, coords });
//         socket.join("onDuty");
//         console.log(`rider ${user.id} is now on duty.`);
//         updateNearbyriders();
//       });

//       socket.on("goOffDuty", () => {
//         onDutyRiders.delete(user.id);
//         socket.leave("onDuty");
//         console.log(`rider ${user.id} is now off duty.`);
//         updateNearbyriders();
//       });

//       socket.on("updateLocation", (coords) => {
//         if (onDutyRiders.has(user.id)) {
//           onDutyRiders.get(user.id).coords = coords;
//           console.log(`rider ${user.id} updated location.`);
//           updateNearbyriders();
//           socket.to(`rider_${user.id}`).emit("riderLocationUpdate", {
//             riderId: user.id,
//             coords,
//           });
//         }
//       });
//     }

//     if (user.role === "customer") {
//       socket.on("subscribeToZone", (customerCoords) => {
//         socket.user.coords = customerCoords;
//         sendNearbyRiders(socket, customerCoords);
//       });

//       socket.on("searchrider", async (rideId) => {
//         try {
//           const ride = await Ride.findById(rideId).populate("customer rider");
//           if (!ride) return socket.emit("error", { message: "Ride not found" });

//           const { latitude: pickupLat, longitude: pickupLon } = ride.pickup;

//           let retries = 0;
//           let rideAccepted = false;
//           let canceled = false;
//           const MAX_RETRIES = 20;

//           const retrySearch = async () => {
//             if (canceled) return;
//             retries++;

//             const riders = sendNearbyRiders(socket, { latitude: pickupLat, longitude: pickupLon }, ride);
//             if (riders.length > 0 || retries >= MAX_RETRIES) {
//               clearInterval(retryInterval);
//               if (!rideAccepted && retries >= MAX_RETRIES) {
//                 await Ride.findByIdAndDelete(rideId);
//                 socket.emit("error", { message: "No riders found within 5 minutes." });
//               }
//             }
//           };

//           const retryInterval = setInterval(retrySearch, 10000);

//           socket.on("rideAccepted", () => {
//             rideAccepted = true;
//             clearInterval(retryInterval);
//           });

//           socket.on("cancelRide", async () => {
//             canceled = true;
//             clearInterval(retryInterval);
//             await Ride.findByIdAndDelete(rideId);
//             socket.emit("rideCanceled", { message: "Ride canceled" });

//             if (ride.rider) {
//               const riderSocket = getRiderSocket(ride.rider._id);
//               riderSocket?.emit("rideCanceled", { message: `Customer ${user.id} canceled the ride.` });
//             }
//             console.log(`Customer ${user.id} canceled ride ${rideId}`);
//           });
//         } catch (error) {
//           console.error("Error searching for rider:", error);
//           socket.emit("error", { message: "Error searching for rider" });
//         }
//       });
//     }

//     socket.on("subscribeToriderLocation", (riderId) => {
//       const rider = onDutyRiders.get(riderId);
//       if (rider) {
//         socket.join(`rider_${riderId}`);
//         socket.emit("riderLocationUpdate", { riderId, coords: rider.coords });
//         console.log(`User ${user.id} subscribed to rider ${riderId}'s location.`);
//       }
//     });

//     socket.on("subscribeRide", async (rideId) => {
//       socket.join(`ride_${rideId}`);
//       try {
//         const rideData = await Ride.findById(rideId).populate("customer rider");
//         socket.emit("rideData", rideData);
//       } catch (error) {
//         socket.emit("error", { message: "Failed to receive ride data" });
//       }
//     });

//     socket.on("disconnect", () => {
//       if (user.role === "rider") onDutyRiders.delete(user.id);
//       console.log(`${user.role} ${user.id} disconnected.`);
//     });

//     function updateNearbyriders() {
//       io.sockets.sockets.forEach((socket) => {
//         if (socket.user?.role === "customer") {
//           const customerCoords = socket.user.coords;
//           if (customerCoords) sendNearbyRiders(socket, customerCoords);
//         }
//       });
//     }

//     function sendNearbyRiders(socket, location, ride = null) {
//       const nearbyriders = Array.from(onDutyRiders.values())
//         .map((rider) => ({
//           ...rider,
//           distance: geolib.getDistance(rider.coords, location),
//         }))
//         .filter((rider) => rider.distance <= 60000)
//         .sort((a, b) => a.distance - b.distance);

//       // socket.emit("nearbyriders", nearbyriders);
//       socket.emit("nearbyRiders", nearbyriders.map(rider => ({
//         id: rider.socketId, // or use rider._id if you store it
//         coords: rider.coords,
//         type: rider.type || 'rider'
//       })));

//       if (ride) {
//         nearbyriders.forEach((rider) => {
//           io.to(rider.socketId).emit("rideOffer", ride);
//         });
//       }

//       return nearbyriders;
//     }

//     function getRiderSocket(riderId) {
//       const rider = onDutyRiders.get(riderId);
//       return rider ? io.sockets.sockets.get(rider.socketId) : null;
//     }
//   });
// };

// export default handleSocketConnection;
import geolib from "geolib";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Ride from "../models/Ride.js";

const onDutyRiders = new Map();

const handleSocketConnection = (io) => {
  // socket auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.headers.access_token;
      if (!token) return next(new Error("Authentication invalid: No token"));

      const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(payload.id);
      if (!user) return next(new Error("Authentication invalid: User not found"));

      socket.user = { id: payload.id, role: user.role, raw: user };
      next();
    } catch (error) {
      console.error("Socket Auth Error:", error);
      next(new Error("Authentication invalid: Token verification failed"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    console.log(`User Joined: ${user.id} (${user.role}) - socket ${socket.id}`);

    // RIDER HANDLERS
    if (user.role === "rider") {
      socket.on("goOnDuty", (coords) => {
        onDutyRiders.set(user.id, { socketId: socket.id, coords });
        socket.join("onDuty");
        console.log(`rider ${user.id} is now on duty. socket=${socket.id}`);
        updateNearbyriders();
      });

      socket.on("goOffDuty", () => {
        onDutyRiders.delete(user.id);
        socket.leave("onDuty");
        console.log(`rider ${user.id} is now off duty.`);
        updateNearbyriders();
      });

      socket.on("updateLocation", (coords) => {
        if (onDutyRiders.has(user.id)) {
          onDutyRiders.get(user.id).coords = coords;
          console.log(`rider ${user.id} updated location.`);
          updateNearbyriders();
          socket.to(`rider_${user.id}`).emit("riderLocationUpdate", {
            riderId: user.id,
            coords,
          });
        }
      });
    }

    // CUSTOMER HANDLERS
    if (user.role === "customer") {
      socket.on("subscribeToZone", (customerCoords) => {
        socket.user.coords = customerCoords;
        sendNearbyRiders(socket, customerCoords);
      });

      socket.on("searchrider", async (rideId) => {
        try {
          const ride = await Ride.findById(rideId).populate("customer rider");
          if (!ride) return socket.emit("error", { message: "Ride not found" });

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
            await Ride.findByIdAndDelete(rideId);
            socket.emit("rideCanceled", { message: "Ride canceled" });

            if (ride.rider) {
              const riderSocket = getRiderSocket(ride.rider._id);
              riderSocket?.emit("rideCanceled", { message: `Customer ${user.id} canceled the ride.` });
            }
            console.log(`Customer ${user.id} canceled ride ${rideId}`);
          });
        } catch (error) {
          console.error("Error searching for rider:", error);
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
        console.log(`User ${user.id} subscribed to rider ${riderId}'s location.`);
      }
    });

    // Subscribe to a specific ride: join room and emit current ride data
    socket.on("subscribeRide", async (rideId) => {
      try {
        console.log('[io] subscribeRide', { socketId: socket.id, rideId });
        // join a room for this ride for future updates
        socket.join(`ride:${rideId}`);

        // fetch current ride from DB and send to the requester
        const ride = await Ride.findById(rideId).populate("customer rider").lean().exec();
        if (ride) {
          const payload = { ride };
          socket.emit("rideData", payload);
          console.log('[io] emitted rideData to', socket.id, rideId);
        } else {
          socket.emit("error", { message: "Ride not found", rideId });
        }
      } catch (err) {
        console.error('[io] subscribeRide error', err);
        socket.emit("error", { message: "Failed to subscribe ride", error: err.message });
      }
    });

    // Customer requests server to broadcast a search to riders for the ride's vehicle type
    socket.on("searchRide", async (rideId) => {
      try {
        const ride = await Ride.findById(rideId).lean().exec();
        if (!ride) return;
        const room = `riders:${ride.vehicle}`;
        const payload = { rideId, ride };
        io.to(room).emit("ride:new_request", payload);
        console.log('[io] emitted ride:new_request to', room, 'for', rideId);
      } catch (err) {
        console.error('[io] searchRide error', err);
      }
    });

    // Rider sends offer back to a customer; forward to customer socket id
    socket.on("offer:send", (offer) => {
      try {
        console.log('[io] offer:send', offer?.rideId, 'from', socket.id);
        if (offer?.customerSocketId) {
          io.to(offer.customerSocketId).emit("ride:offer", offer);
          console.log('[io] forwarded offer to customer', offer.customerSocketId);
        } else {
          console.warn('[io] offer missing customerSocketId', offer);
        }
      } catch (err) {
        console.error('[io] offer:send error', err);
      }
    });

    socket.on("disconnect", () => {
      if (user.role === "rider") onDutyRiders.delete(user.id);
      console.log(`${user.role} ${user.id} disconnected. socket=${socket.id}`);
    });

    // helper functions
    function updateNearbyriders() {
      io.sockets.sockets.forEach((s) => {
        if (s.user?.role === "customer") {
          const customerCoords = s.user.coords;
          if (customerCoords) sendNearbyRiders(s, customerCoords);
        }
      });
    }

    function sendNearbyRiders(socketInstance, location, ride = null) {
      const nearbyriders = Array.from(onDutyRiders.values())
        .map((rider) => ({
          ...rider,
          distance: geolib.getDistance(rider.coords, location),
        }))
        .filter((rider) => rider.distance <= 60000)
        .sort((a, b) => a.distance - b.distance);

      socketInstance.emit("nearbyRiders", nearbyriders.map(rider => ({
        id: rider.socketId,
        coords: rider.coords,
        type: rider.type || 'rider'
      })));

      if (ride) {
        nearbyriders.forEach((rider) => {
          io.to(rider.socketId).emit("rideOffer", ride);
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