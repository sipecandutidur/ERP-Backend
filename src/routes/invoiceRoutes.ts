import { Router } from 'express';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  addPayment,
  generateFromQuotation,
} from '../controllers/invoiceController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.post('/', createInvoice);
router.post('/:id/payments', addPayment);
router.post('/generate/from-quotation/:quotationId', generateFromQuotation);

export default router;
