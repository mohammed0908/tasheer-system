import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { getUnreadNotifications, markNotificationRead } from '../controllers/notificationController.js';

const router = express.Router();

router.get('/unread', protect, authorize('staff', 'admin', 'client'), getUnreadNotifications);
router.put('/:id/read', protect, authorize('staff', 'admin', 'client'), markNotificationRead);

export default router;
