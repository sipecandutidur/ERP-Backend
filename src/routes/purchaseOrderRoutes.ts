import { Router } from 'express';
import {
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
  updatePurchaseOrderItemStatus,
  generateFromQuotation,
} from '../controllers/purchaseOrderController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getPurchaseOrders);
router.get('/:id', getPurchaseOrderById);
router.post('/generate/from-quotation/:quotationId', generateFromQuotation);
router.patch('/:id/status', updatePurchaseOrderStatus);
router.patch('/:id/items/:itemId/status', updatePurchaseOrderItemStatus);

export default router;
