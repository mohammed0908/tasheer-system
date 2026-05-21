import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { uploadDocument } from '../controllers/documentController.js';

const router = express.Router();

router.post('/', protect, authorize('admin', 'staff'), upload.single('document'), uploadDocument);

export default router;
