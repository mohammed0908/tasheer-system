import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { getAllUsers, getStaffMembers, getUserProfile, updateUserProfile, deleteUser, updateProfileImage } from '../controllers/userController.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.put('/:id/profile-image', protect, upload.single('profile_image'), updateProfileImage);
router.get('/staff', protect, authorize('admin', 'staff'), getStaffMembers);
router.get('/', protect, authorize('admin'), getAllUsers);
router.delete('/:id', protect, authorize('admin'), deleteUser);

export default router;
