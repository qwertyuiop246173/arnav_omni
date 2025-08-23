// import express from 'express';

// import { refreshToken, auth } from '../controllers/auth.js';

// const router = express.Router();

// router.post('/refresh-token', refreshToken);
// router.post('/signin', auth);

// export default router;

import express from 'express';
import { auth } from '../controllers/auth.js';
import * as authController from '../controllers/auth.js'
import authentication from '../middleware/authentication.js'
const router = express.Router();

router.post('/signin', auth);
router.get('/me', authentication, authController.me)
export default router;