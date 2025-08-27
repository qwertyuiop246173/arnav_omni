import Ride from "../models/Ride.js";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import {
  calculateDistance,
  calculateFare,
  generateOTP,
} from "../utils/mapUtils.js";

// export const createRide = async (req, res) => {
//   const { vehicle, pickup, drop } = req.body;

//   if (!vehicle || !pickup || !drop) {
//     throw new BadRequestError("Vehicle, pickup, and drop details are required");
//   }

//   const {
//     address: pickupAddress,
//     latitude: pickupLat,
//     longitude: pickupLon,
//   } = pickup;

//   const { address: dropAddress, latitude: dropLat, longitude: dropLon } = drop;

//   if (
//     !pickupAddress ||
//     !pickupLat ||
//     !pickupLon ||
//     !dropAddress ||
//     !dropLat ||
//     !dropLon
//   ) {
//     throw new BadRequestError("Complete pickup and drop details are required");
//   }

//   const customer = req.user;

//   try {
//     const distance = calculateDistance(pickupLat, pickupLon, dropLat, dropLon);
//     const fare = calculateFare(distance, vehicle);

//     const ride = new Ride({
//       vehicle,
//       distance,
//       fare: fare[vehicle],
//       pickup: {
//         address: pickupAddress,
//         latitude: pickupLat,
//         longitude: pickupLon,
//       },
//       drop: { address: dropAddress, latitude: dropLat, longitude: dropLon },
//       customer: customer.id,
//       otp: generateOTP(),
//     });

//     await ride.save();

//     res.status(StatusCodes.CREATED).json({
//       message: "Ride created successfully",
//       ride,
//     });
//   } catch (error) {
//     console.error(error);
//     throw new BadRequestError("Failed to create ride");
//   }
// };


// export const createRide = async (req, res) => {
//   try {
//     const { vehicle, pickup, drop, fare, distance } = req.body;
//     if (!vehicle || !pickup || !drop || fare === undefined || distance === undefined) {
//       throw new BadRequestError("Vehicle, pickup, drop, fare, and distance are required");
//     }
//     console.log('Ride creation payload:', req.body); // <-- Add this line
//     // Add customer ID from authenticated user
//     const ride = await Ride.create({
//       customer: req.user.userId,  // This comes from auth middleware
//       vehicle,
//       pickup,
//       drop,
//       fare,
//       distance,
//     });

//     console.log('Created ride:', ride);
//     res.status(StatusCodes.CREATED).json({ ride });
//   } catch (error) {
//     console.error('Create ride error:', error);
//     res.status(StatusCodes.BAD_REQUEST).json({
//       msg: error.message || 'Failed to create ride'
//     });
//   }
// };
const generateOtp = () => {
  return Math.floor(1000 + Math.random() * 9000).toString()
}
export const createRide = async (req, res) => {
  try {
    console.log('[ride.create] incoming body:', req.body)
    // prefer authenticated user id from middleware
    const customerId = req.user?.userId || req.user?.id || req.user?._id || null

    const { vehicle, pickup, drop, fare: bodyFare, distance: bodyDistance } = req.body || {}

    // collect missing fields for clear response
    const missing = []
    if (!vehicle) missing.push('vehicle')
    if (!pickup || !pickup.address || pickup.latitude == null || pickup.longitude == null) missing.push('pickup.{address,latitude,longitude}')
    if (!drop || !drop.address || drop.latitude == null || drop.longitude == null) missing.push('drop.{address,latitude,longitude}')
    if (!customerId) missing.push('authenticated customer (req.user)')

    if (missing.length) {
      console.warn('[ride.create] validation failed, missing:', missing)
      return res.status(400).json({ message: 'Missing required fields', missing })
    }

    // compute distance/fare if not provided and coordinates available
    let distance = bodyDistance
    let fare = bodyFare
    try {
      if ((distance === undefined || fare === undefined) && pickup && drop) {
        const pLat = Number(pickup.latitude)
        const pLng = Number(pickup.longitude)
        const dLat = Number(drop.latitude)
        const dLng = Number(drop.longitude)
        if (Number.isFinite(pLat) && Number.isFinite(pLng) && Number.isFinite(dLat) && Number.isFinite(dLng)) {
          distance = calculateDistance(pLat, pLng, dLat, dLng)
          const fares = calculateFare(distance, vehicle)
          fare = fares && fares[vehicle] ? fares[vehicle] : (bodyFare ?? 0)
          console.log('[ride.create] calculated distance & fare', { distance, fare })
        }
      }
    } catch (e) {
      console.warn('[ride.create] distance/fare calc failed', e)
    }

    // build ride payload
    const ridePayload = {
      vehicle,
      pickup: {
        address: pickup.address,
        latitude: Number(pickup.latitude),
        longitude: Number(pickup.longitude)
      },
      drop: {
        address: drop.address,
        latitude: Number(drop.latitude),
        longitude: Number(drop.longitude)
      },
      customer: customerId,
      distance: distance ?? 0,
      fare: fare ?? 0,
      status: 'SEARCHING_FOR_RIDER',
      otp: generateOTP()
    }

    console.log('[ride.create] creating ride with payload (otp generated):', {
      vehicle: ridePayload.vehicle,
      customer: ridePayload.customer,
      otp: ridePayload.otp,
      distance: ridePayload.distance,
      fare: ridePayload.fare
    })

    const ride = new Ride(ridePayload)
    const saved = await ride.save()
    console.log('[ride.create] ride saved id=', saved._id)

    const populated = await Ride.findById(saved._id).populate('customer').lean().exec()
    console.log('[ride.create] returning ride to client with otp=', populated?.otp)

    return res.status(StatusCodes.CREATED).json({ ride: populated })
  } catch (err) {
    console.error('[ride.create] error', err)
    return res.status(500).json({ message: 'Failed to create ride', error: err.message })
  }
}
export const acceptRide = async (req, res) => {
  const riderId = req.user.id;
  const { rideId } = req.params;

  if (!rideId) {
    throw new BadRequestError("Ride ID is required");
  }

  try {
    let ride = await Ride.findById(rideId).populate("customer");

    if (!ride) {
      throw new NotFoundError("Ride not found");
    }
    const status = String(ride.status ?? '').toUpperCase();
    // Reject if cancelled/completed/no-rider — include explicit cancelled-by flags
    if (['CANCELLED', 'RIDE_CANCELLED_BY_CUSTOMER', 'RIDE_CANCELLED_BY_RIDER', 'COMPLETED', 'NO_RIDER_ALLOTTED'].includes(status)) {
      return res.status(400).json({ message: 'Ride is no longer available' });
    }

    // Ensure this rider was actually offered the ride
    const offered = Array.isArray(ride.offeredTo) ? ride.offeredTo.map(String) : [];
    if (!offered.includes(String(riderId))) {
      return res.status(400).json({ message: 'Offer cancelled or not valid for this rider' });
    }
    if (ride.status !== "SEARCHING_FOR_RIDER") {
      throw new BadRequestError("Ride is no longer available for assignment");
    }

    ride.rider = riderId;
    ride.status = "START";
    await ride.save();

    ride = await ride.populate("rider");

    // req.socket.to(`ride_${rideId}`).emit("rideUpdate", ride);
    // req.socket.to(`ride_${rideId}`).emit("rideAccepted");

    // emit via socket.io instance stored on app
    const io = req?.app?.get?.('io')
    if (io) {
      io.to(`ride:${rideId}`).emit('rideUpdate', ride)
      io.to(`ride:${rideId}`).emit('rideAccepted')
      console.log('[ride] emitted rideUpdate & rideAccepted to room ride:' + rideId)
    } else {
      console.warn('[ride] socket.io instance not available on req.app; skipping emit')
    }
    res.status(StatusCodes.OK).json({
      message: "Ride accepted successfully",
      ride,
    });
  } catch (error) {
    console.error("Error accepting ride:", error);
    throw new BadRequestError("Failed to accept ride");
  }
};

export const getRideById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Missing ride id' });

    const ride = await Ride.findById(id).populate('customer rider').lean().exec();
    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    return res.status(200).json({ ride });
  } catch (err) {
    console.error('[controllers/ride] getRideById error', err);
    return next(err);
  }
};
// export const updateRideStatus = async (req, res) => {
//   const { rideId } = req.params;
//   const { status } = req.body;

//   if (!rideId || !status) {
//     throw new BadRequestError("Ride ID and status are required");
//   }

//   try {
//     let ride = await Ride.findById(rideId).populate("customer rider");

//     if (!ride) {
//       throw new NotFoundError("Ride not found");
//     }

//     if (!["START", "ARRIVED", "COMPLETED"].includes(status)) {
//       throw new BadRequestError("Invalid ride status");
//     }

//     ride.status = status;
//     await ride.save();

//     // req.socket.to(`ride_${rideId}`).emit("rideUpdate", ride);
//     const io = req?.app?.get?.('io')
//     if (io) {
//       io.to(`ride:${rideId}`).emit('rideUpdate', ride)
//       console.log('[ride] emitted rideUpdate to room ride:' + rideId, 'status=', status)
//     } else {
//       console.warn('[ride] socket.io instance not available on req.app; skipping emit')
//     }

//     res.status(StatusCodes.OK).json({
//       message: `Ride status updated to ${status}`,
//       ride,
//     });
//   } catch (error) {
//     console.error("Error updating ride status:", error);
//     throw new BadRequestError("Failed to update ride status");
//   }
// };
export const updateRideStatus = async (req, res) => {
  const { rideId } = req.params;
  const { status } = req.body;

  if (!rideId || !status) {
    throw new BadRequestError("Ride ID and status are required");
  }

  try {
    let ride = await Ride.findById(rideId).populate("customer rider");

    if (!ride) {
      throw new NotFoundError("Ride not found");
    }

    if (!["START", "ARRIVED", "COMPLETED"].includes(status)) {
      throw new BadRequestError("Invalid ride status");
    }

    ride.status = status;
    await ride.save();

    // req.socket.to(`ride_${rideId}`).emit("rideUpdate", ride);
    // emit via socket.io instance stored on the express app (same pattern as acceptRide)
    const io = req?.app?.get?.('io');
    if (io && typeof io.to === 'function') {
      // use the same room naming as acceptRide: `ride:<id>`
      io.to(`ride:${rideId}`).emit('rideUpdate', ride);
      console.log('[ride.updateRideStatus] emitted rideUpdate to room ride:' + rideId, 'status=', status);
    } else {
      console.warn('[ride.updateRideStatus] socket.io instance not available on req.app; skipping emit');
    }

    res.status(StatusCodes.OK).json({
      message: `Ride status updated to ${status}`,
      ride,
    });
  } catch (error) {
    console.error("Error updating ride status:", error);
    throw new BadRequestError("Failed to update ride status");
  }
};
export const getMyRides = async (req, res) => {
  const userId = req.user.id;
  const { status } = req.query;

  try {
    const query = {
      $or: [{ customer: userId }, { rider: userId }],
    };

    if (status) {
      query.status = status;
    }

    const rides = await Ride.find(query)
      .populate("customer", "name phone")
      .populate("rider", "name phone")
      .sort({ createdAt: -1 });

    res.status(StatusCodes.OK).json({
      message: "Rides retrieved successfully",
      count: rides.length,
      rides,
    });
  } catch (error) {
    console.error("Error retrieving rides:", error);
    throw new BadRequestError("Failed to retrieve rides");
  }
};

export const cancelRide = async (req, res) => {
  try {
    const rideId = req.params?.rideId ?? req.body?.rideId
    if (!rideId) return res.status(400).json({ message: 'rideId required' })

    const riderUserId = req.user?.id ?? req.user?.userId ?? req.user?._id
    const ride = await Ride.findById(rideId)
    if (!ride) return res.status(404).json({ message: 'Ride not found' })

    // only customer who created ride (or admin) can cancel via this endpoint
    if (String(ride.customer) !== String(riderUserId)) {
      return res.status(403).json({ message: 'Not authorized to cancel this ride' })
    }

    // idempotent: if already cancelled/finished, return current state
    const currentStatus = String(ride.status ?? '').toUpperCase()
    if (currentStatus === 'CANCELLED' || currentStatus === 'COMPLETED') {
      const populated = await Ride.findById(rideId).populate('customer rider').lean().exec()
      return res.status(200).json({ message: 'Ride already finished', ride: populated })
    }

    // update status
    ride.status = 'CANCELLED'
    ride.cancelledBy = 'customer'
    await ride.save()

    // clear any active offer timers for this ride
    try {
      if (typeof clearTimersForRide === 'function') {
        clearTimersForRide(String(rideId))
      } else {
        console.warn('[ride.cancel] clearTimersForRide not available')
      }
    } catch (e) {
      console.warn('[ride.cancel] clearTimers failed', e)
    }

    // emit update to interested sockets (ride room, customer, rider)
    const io = req?.app?.get?.('io')
    const updatedRide = await Ride.findById(rideId).populate('customer rider').lean().exec()
    if (io) {
      io.to(`ride:${rideId}`).emit('rideUpdate', updatedRide)
      io.to(`ride:${rideId}`).emit('ride:cancelled', { rideId: String(rideId), by: 'customer' })
      if (updatedRide?.customer) {
        io.to(String(updatedRide.customer)).emit('ride:cancelled', { rideId: String(rideId), by: 'customer' })
        io.to(`customer:${String(updatedRide.customer)}`).emit('ride:cancelled', { rideId: String(rideId), by: 'customer' })
      }
      if (updatedRide?.rider) {
        io.to(String(updatedRide.rider)).emit('ride:cancelled', { rideId: String(rideId), by: 'customer' })
        io.to(`rider:${String(updatedRide.rider)}`).emit('ride:cancelled', { rideId: String(rideId), by: 'customer' })
      }
      console.log('[ride.cancel] emitted ride:cancelled & rideUpdate for', rideId)
    } else {
      console.log('[ride.cancel] io not available to emit ride cancellations')
    }

    return res.status(200).json({ message: 'Ride cancelled', ride: updatedRide })
  } catch (err) {
    console.error('[ride.cancel] error', err)
    return res.status(500).json({ message: 'Failed to cancel ride', error: err.message })
  }
}