import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { createGoal, deleteGoal, getGoals, updateGoal } from '../controllers/goalController.js';

const router = express.Router();

router.get('/', protect, authorize('admin', 'staff'), getGoals);
router.post('/', protect, authorize('admin'), createGoal);
router.put('/:id', protect, authorize('admin'), updateGoal);
router.delete('/:id', protect, authorize('admin'), deleteGoal);

export default router;
