import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  createMessage,
  deleteMessage,
  editMessage,
  getContacts,
  getConversations,
  getMessages,
  getUnreadCount,
  markMessagesAsRead,
  reactToMessage
} from '../controllers/messageController.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/conversations', protect, authorize('staff', 'admin'), getConversations);
router.get('/contacts', protect, authorize('client', 'staff', 'admin'), getContacts);
router.get('/unread-count', protect, authorize('client', 'staff', 'admin'), getUnreadCount);
router.put('/read/:senderId', protect, authorize('client', 'staff', 'admin'), markMessagesAsRead);
router.get('/', protect, authorize('client', 'staff', 'admin'), getMessages);
router.post('/', protect, authorize('client', 'staff', 'admin'), upload.fields([
  { name: 'attachment', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), createMessage);
router.put('/:id', protect, authorize('client', 'staff', 'admin'), editMessage);
router.delete('/:id', protect, authorize('client', 'staff', 'admin'), deleteMessage);
router.post('/:id/react', protect, authorize('client', 'staff', 'admin'), reactToMessage);

export default router;
