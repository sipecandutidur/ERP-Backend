import { Router } from 'express';
import {
  getDistributors,
  getDistributorById,
  createDistributor,
  updateDistributor,
  deleteDistributor,
} from '../controllers/distributorController';
import { importDistributors } from '../controllers/importController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getDistributors);
router.get('/:id', getDistributorById);
router.post('/import', importDistributors);
router.post('/', createDistributor);
router.put('/:id', updateDistributor);
router.delete('/:id', deleteDistributor);

export default router;
