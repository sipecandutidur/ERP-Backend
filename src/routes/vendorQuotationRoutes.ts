import { Router } from 'express';
import {
  getVendorQuotations,
  getVendorQuotationById,
  createVendorQuotation,
  updateVendorQuotationStatus,
  generateFromQuotation,
} from '../controllers/vendorQuotationController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getVendorQuotations);
router.get('/:id', getVendorQuotationById);
router.post('/', createVendorQuotation);
router.post('/generate/from-quotation/:quotationId', generateFromQuotation);
router.patch('/:id/status', updateVendorQuotationStatus);

export default router;
