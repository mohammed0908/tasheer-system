import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  acceptProposedMeetingTime,
  approveMeeting,
  cancelMeeting,
  getMeetings,
  proposeMeetingTime,
  requestMeeting
} from '../controllers/meetingController.js';

const router = express.Router();

router.post('/', protect, authorize('client'), requestMeeting);
router.get('/', protect, authorize('client', 'staff', 'admin'), getMeetings);
router.put('/:id/propose', protect, authorize('staff', 'admin'), proposeMeetingTime);
router.put('/:id/student-accept', protect, authorize('client'), acceptProposedMeetingTime);
router.put('/:id/approve', protect, authorize('staff', 'admin'), approveMeeting);
router.put('/:id/cancel', protect, authorize('client', 'staff', 'admin'), cancelMeeting);

export default router;
