import { Router } from 'express';
import {
  getDeliveryNotes,
  getDeliveryNoteById,
  createDeliveryNote,
  updateDeliveryNoteStatus,
  generateFromQuotation,
  updateDeliveryNoteItem,
} from '../controllers/deliveryNoteController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getDeliveryNotes);
router.get('/:id', getDeliveryNoteById);
router.post('/', createDeliveryNote);
router.patch('/:id/status', updateDeliveryNoteStatus);
router.patch('/:id/items/:itemId', updateDeliveryNoteItem);
router.post('/generate/from-quotation/:quotationId', generateFromQuotation);

export default router;
