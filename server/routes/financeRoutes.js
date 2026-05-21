import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { createExpense, createSalaryExpense, getFinanceSummary, getPayrollStaff, recordSalaries } from '../controllers/financeController.js';

const router = express.Router();

router.get('/summary', protect, authorize('admin', 'staff'), getFinanceSummary);
router.get('/payroll-staff', protect, authorize('admin'), getPayrollStaff);
router.post('/expenses', protect, authorize('admin'), createExpense);
router.post('/record-salaries', protect, authorize('admin'), recordSalaries);
router.post('/expenses/salaries', protect, authorize('admin'), createSalaryExpense);

export default router;
