import { Router } from 'express';
import { getUsers, getUserById, updateUser, deleteUser } from '../controllers/userController';
import { authenticate, requireRole } from '../middlewares/authMiddleware';

const router = Router();

// Apply auth middleware to all user routes
router.use(authenticate);

// Only ADMIN can manage users in this example
router.use(requireRole(['ADMIN']));

router.get('/', getUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
