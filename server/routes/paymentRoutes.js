import express from 'express';
import {
  createInvoice,
  getInvoiceById,
  getAllPayments,
  getMyInvoices,
  simulatePayment,
  uploadPaymentReceipt,
  verifyPayment
} from '../controllers/paymentController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/', protect, authorize('admin', 'staff'), getAllPayments);
router.post('/', protect, authorize('admin', 'staff'), createInvoice);
router.post('/simulate', protect, authorize('client'), simulatePayment);
router.get('/my', protect, authorize('client'), getMyInvoices);
router.get('/:id', protect, authorize('admin', 'staff'), getInvoiceById);
router.post('/:id/receipt', protect, authorize('client'), upload.single('receipt'), uploadPaymentReceipt);
router.put('/:id/verify', protect, authorize('admin', 'staff'), verifyPayment);

export default router;
