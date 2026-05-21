import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { getAdminNotifications } from '../controllers/notificationController.js';

const router = express.Router();

router.get('/notifications', protect, authorize('admin'), getAdminNotifications);

export default router;
