import express from 'express';
import { createRide, updateRideStatus, acceptRide, getMyRides,getRideById } from '../controllers/ride.js';
import  auth  from '../middleware/authentication.js';

const router = express.Router();

router.use((req, res, next) => {
  req.io = req.app.get('io');
  next();
});

router.post('/create', createRide);
router.patch('/accept/:rideId', acceptRide);
router.patch('/update/:rideId', updateRideStatus);
router.get('/rides', getMyRides);
router.get('/:id', auth, getRideById);
export default router;
