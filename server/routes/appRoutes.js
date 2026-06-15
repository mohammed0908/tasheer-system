import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  createApplication,
  createClientApplication,
  getStudentApplication,
  getAllApplications,
  updateApplicationStage,
  updateVisaProgress,
  advanceApplicationState,
  assignApplication,
  assignCounselorToApplication,
  getDashboardKPIs,
  getAssignedApplications,
  createNewApplication,
  uploadApplicationDocument,
  requestMissingDocuments,
  uploadMissingDocuments
} from '../controllers/appController.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// KPI Route for Admin and Staff
router.get('/kpis', protect, authorize('admin', 'staff'), getDashboardKPIs);

// Routes for Staff and Admin
router.get('/assigned', protect, authorize('staff', 'admin'), getAssignedApplications);
router.get('/', protect, authorize('admin', 'staff'), getAllApplications);
router.put('/:id/advance-state', protect, authorize('staff', 'admin', 'client'), upload.fields([
  { name: 'offer_letter', maxCount: 1 },
  { name: 'visa_document', maxCount: 1 },
  { name: 'ticket', maxCount: 1 },
  { name: 'pickup_image', maxCount: 1 },
  { name: 'medical_image', maxCount: 1 },
  { name: 'registration_image', maxCount: 1 },
  { name: 'accommodation_images', maxCount: 10 }
]), advanceApplicationState);
router.put('/:id/visa-progress', protect, authorize('staff', 'admin'), updateVisaProgress);
router.put('/:id/assign-counselor', protect, authorize('staff', 'admin'), assignCounselorToApplication);
router.post('/:id/missing-documents', protect, authorize('staff', 'admin'), requestMissingDocuments);
router.put('/:id/upload-missing-docs', protect, authorize('client'), upload.array('missing_docs', 10), uploadMissingDocuments);
router.put('/:id/stage', protect, authorize('admin', 'staff'), updateApplicationStage);
router.post('/:id/documents', protect, authorize('client'), upload.single('document'), uploadApplicationDocument);

// Route exclusively for Admin assignment
router.patch('/:id/assign', protect, authorize('admin'), assignApplication);

// Route for creating application with file uploads
router.post('/new', protect, authorize('admin', 'staff'), upload.fields([
  { name: 'studyCertificate', maxCount: 1 },
  { name: 'personalPhoto', maxCount: 1 },
  { name: 'passportCopy', maxCount: 1 },
  { name: 'otherDocuments', maxCount: 5 }
]), createNewApplication);

// Routes for Client, Staff, and Admin
router.post('/client-create', protect, authorize('client'), createClientApplication);
router.post('/', protect, authorize('client', 'admin', 'staff'), createApplication);
router.get('/my-application', protect, authorize('client'), getStudentApplication);

export default router;
