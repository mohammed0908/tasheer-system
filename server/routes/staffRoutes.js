import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { createStaff, getMyActiveActions, getMyStaffMetrics, getStaffMembers, toggleStaffStar, updateStaff } from '../controllers/userController.js';

const router = express.Router();

router.get('/', protect, authorize('admin', 'staff'), getStaffMembers);
router.get('/me/active-actions', protect, authorize('staff'), getMyActiveActions);
router.get('/me/metrics', protect, authorize('staff'), getMyStaffMetrics);
router.post('/', protect, authorize('admin'), createStaff);
router.put('/:id', protect, authorize('admin'), updateStaff);
router.put('/:id/star', protect, authorize('admin'), toggleStaffStar);

export default router;
