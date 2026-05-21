import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { getAdminAnalytics } from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/analytics', protect, authorize('admin'), getAdminAnalytics);

export default router;
