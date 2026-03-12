import { Router } from 'express';
import {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  updateQuotationStatus,
} from '../controllers/quotationController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getQuotations);
router.get('/:id', getQuotationById);
router.post('/', createQuotation);
router.put('/:id', updateQuotation);
router.patch('/:id/status', updateQuotationStatus);

export default router;
