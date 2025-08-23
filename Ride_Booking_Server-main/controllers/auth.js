// import User from "../models/User.js";
// import { StatusCodes } from "http-status-codes";
// import { BadRequestError, UnauthenticatedError } from "../errors/index.js";
// import jwt from "jsonwebtoken";

// export const auth = async (req, res) => {
//   const { phone, role } = req.body;

//   if (!phone) {
//     throw new BadRequestError("Phone number is required");
//   }

//   if (!role || !["customer", "rider"].includes(role)) {
//     throw new BadRequestError("Valid role is required (customer or rider)");
//   }

//   try {
//     let user = await User.findOne({ phone });

//     if (user) {
//       if (user.role !== role) {
//         throw new BadRequestError("Phone number and role do not match");
//       }

//       const accessToken = user.createAccessToken();
//       const refreshToken = user.createRefreshToken();

//       return res.status(StatusCodes.OK).json({
//         message: "User logged in successfully",
//         user,
//         access_token: accessToken,
//         refresh_token: refreshToken,
//       });
//     }

//     user = new User({
//       phone,
//       role,
//     });

//     await user.save();

//     const accessToken = user.createAccessToken();
//     const refreshToken = user.createRefreshToken();

//     res.status(StatusCodes.CREATED).json({
//       message: "User created successfully",
//       user,
//       access_token: accessToken,
//       refresh_token: refreshToken,
//     });
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// };

// export const refreshToken = async (req, res) => {
//   const { refresh_token } = req.body;
//   if (!refresh_token) {
//     throw new BadRequestError("Refresh token is required");
//   }

//   try {
//     const payload = jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET);
//     const user = await User.findById(payload.id);

//     if (!user) {
//       throw new UnauthenticatedError("Invalid refresh token");
//     }

//     const newAccessToken = user.createAccessToken();
//     const newRefreshToken = user.createRefreshToken();

//     res.status(StatusCodes.OK).json({
//       access_token: newAccessToken,
//       refresh_token: newRefreshToken,
//     });
//   } catch (error) {
//     console.error(error);
//     throw new UnauthenticatedError("Invalid refresh token");
//   }
// };

import { StatusCodes } from 'http-status-codes';
import { UnauthenticatedError, BadRequestError } from '../errors/index.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';


export const auth = async (req, res) => {
    try {
        console.log('auth route called');
        console.log('Incoming headers:', req.headers);
        console.log('Request body:', req.body);
        console.log('Phone received from app:', req.body.phone); // <-- Add this lines
        const { phone, role } = req.body;

        if (!phone || !role) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Please provide phone number and role' });
        }

        let user = await User.findOne({ phone, role });
        if (!user) {
            user = await User.create({ phone, role });
        }
        console.log('User found or created:', user);
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
        );

        const refresh_token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
        );

        return res.status(200).json({
            user,
            token,
            refresh_token
        });
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({ message: 'Authentication failed', error: error.message });
    }
};

export const refreshToken = async (req, res) => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Refresh token is required" });
        }

        const payload = jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(payload.userId);

        if (!user) {
            return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Invalid refresh token" });
        }

        const newToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
        );

        return res.status(StatusCodes.OK).json({
            token: newToken
        });
    } catch (error) {
        console.error("Refresh token error:", error);
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Invalid refresh token", error: error.message });
    }
};
export const me = async (req, res) => {
    try {
        console.log('[auth.me] called, req.user present:', !!req.user)
        // prefer req.user set by auth middleware
        let userId = req.user?.id || req.user?._id || req.user?.userId

        // fallback: try to read token from headers if middleware didn't set req.user
        if (!userId) {
            const header = req.headers['authorization'] || req.headers['access_token'] || req.headers['x-access-token']
            if (!header) {
                console.warn('[auth.me] no auth header or req.user')
                return res.status(401).json({ message: 'Unauthenticated: no token' })
            }
            let token = header
            if (typeof token === 'string' && token.toLowerCase().startsWith('bearer ')) {
                token = token.split(/\s+/)[1]
            }
            const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
            userId = payload?.userId || payload?.id || payload?._id || payload?.userId
            console.log('[auth.me] extracted userId from token payload:', userId)
        }

        const user = await User.findById(userId).select('-password').lean()
        if (!user) {
            console.warn('[auth.me] user not found', userId)
            return res.status(404).json({ message: 'User not found' })
        }

        console.log('[auth.me] returning user', userId)
        return res.status(200).json(user)
    } catch (err) {
        console.error('[auth.me] error', err)
        return res.status(401).json({ message: 'Unauthenticated', error: err.message })
    }
}