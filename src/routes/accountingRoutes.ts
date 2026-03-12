import { Router } from 'express';
import { getFinancialSummary, getTransactions, createTransaction } from '../controllers/accountingController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

// Financial summary (Dashboard)
router.get('/summary', getFinancialSummary);

// Ledger & CashFlow
router.get('/transactions', getTransactions);
router.post('/transactions', createTransaction);

export default router;
