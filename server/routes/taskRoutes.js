import express from 'express';
import { completeTask, createTask, deleteTask, getAllTasks, getMyTasks, updateMyTaskStatus, updateTask } from '../controllers/taskController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/me', protect, authorize('staff'), getMyTasks);
router.put('/:id/status', protect, authorize('staff'), updateMyTaskStatus);
router.put('/:id/complete', protect, authorize('staff', 'admin'), completeTask);
router.get('/', protect, authorize('admin'), getAllTasks);
router.post('/', protect, authorize('admin'), createTask);
router.put('/:id', protect, authorize('admin'), updateTask);
router.delete('/:id', protect, authorize('admin'), deleteTask);

export default router;
