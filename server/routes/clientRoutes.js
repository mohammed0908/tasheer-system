import express from 'express';
import {
  getAllClients,
  getClientDocuments,
  getMyClientDocuments,
  getMyClientProfile,
  registerClientApplication,
  updateClient
} from '../controllers/clientController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/me', protect, authorize('client'), getMyClientProfile);
router.get('/me/documents', protect, authorize('client'), getMyClientDocuments);
router.get('/', protect, authorize('admin', 'staff'), getAllClients);
router.post('/register', protect, authorize('admin', 'staff'), registerClientApplication);
router.get('/:id/documents', protect, authorize('admin', 'staff'), getClientDocuments);
router.put('/:id', protect, authorize('admin', 'staff'), updateClient);

export default router;
