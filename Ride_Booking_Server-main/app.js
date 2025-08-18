import dotenv from 'dotenv';
import 'express-async-errors';
import EventEmitter from 'events';
import express from 'express';
import http from 'http';
import { Server as socketIo } from 'socket.io';
import connectDB from './config/connect.js';
import notFoundMiddleware from './middleware/not-found.js';
import errorHandlerMiddleware from './middleware/error-handler.js';
import authMiddleware from './middleware/authentication.js';
import cors from 'cors';
// Routers
import authRouter from './routes/auth.js';
import rideRouter from './routes/ride.js';

// Import socket handler
import handleSocketConnection from './controllers/sockets.js';

dotenv.config();

EventEmitter.defaultMaxListeners = 20;

const app = express();

app.use(cors()); 
app.use(express.json());

const server = http.createServer(app);

const io = new socketIo(server, { cors: { origin: "*" } });
// Attach the WebSocket instance to the request object
app.use((req, res, next) => {
  req.io = io;
  return next();
});
app.use('/api/auth', authRouter);
// Initialize the WebSocket handling logic
handleSocketConnection(io);

// Add root route
app.get('/', (req, res) => {
  res.json({
    message: 'Ride Booking API is running',
    routes: {
      auth: ['/api/auth/signin', '/api/auth/refresh-token'],
      ride: ['/api/ride', '/api/ride/rides', '/api/ride/:id']
    }
  });
});
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/ride", authMiddleware, rideRouter);

// Middleware
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    server.listen(process.env.PORT || 3000, "0.0.0.0", () =>
      console.log(
        `HTTP server is running on port http://localhost:${process.env.PORT || 3000}`
      )
    );
  } catch (error) {
    console.log(error);
  }
};

start();
