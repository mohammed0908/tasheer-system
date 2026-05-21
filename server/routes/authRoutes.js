import express from 'express';
import {
  forgotPassword,
  getMe,
  loginUser,
  registerUser,
  resetPassword,
  verifyEmail,
  verifyRegistration
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/verify-registration', verifyRegistration);
router.post('/verify-email', verifyEmail);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
