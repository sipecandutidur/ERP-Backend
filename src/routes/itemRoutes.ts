import { Router } from 'express';
import {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  importItems,
} from '../controllers/itemController';
import { importItemsExcel } from '../controllers/importController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/import', importItemsExcel);
router.get('/', getItems);
router.post('/bulk', importItems);
router.get('/:id', getItemById);
router.post('/', createItem);
router.put('/:id', updateItem);
router.delete('/:id', deleteItem);

export default router;
