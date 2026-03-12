import express from 'express';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectDocuments,
  uploadProjectDocument,
  deleteProjectDocument,
  getPipelineProjects,
  updateProjectStage,
} from '../controllers/projectController';
import {
  getRABByProject,
  addRABItem,
  updateRABItem,
  deleteRABItem,
  generateRABFromQuotation
} from '../controllers/rabController';
import {
  getExpensesByProject,
  createExpense,
  updateExpense,
  deleteExpense
} from '../controllers/expenseController';
import { authenticate } from '../middlewares/authMiddleware';
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/projects/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const router = express.Router();

router.use(authenticate);

router.get('/', getProjects);
router.get('/pipeline', getPipelineProjects);  // Must be before /:id
router.get('/:id', getProjectById);
router.post('/', createProject);
router.put('/:id', updateProject);
router.patch('/:id/stage', updateProjectStage);
router.delete('/:id', deleteProject);

// Documents
router.get('/:id/documents', getProjectDocuments);
router.post('/:id/documents/upload', upload.single('file'), uploadProjectDocument);
router.delete('/documents/:docId', deleteProjectDocument);

// RAB
router.get('/:id/rab', getRABByProject);
router.post('/:id/rab/generate', generateRABFromQuotation);
router.post('/:id/rab/items', addRABItem);
router.put('/rab-items/:id', updateRABItem);
router.delete('/rab-items/:id', deleteRABItem);

// Expenses
router.get('/:id/expenses', getExpensesByProject);
router.post('/:id/expenses', createExpense);
router.put('/expenses/:id', updateExpense);
router.delete('/expenses/:id', deleteExpense);

export default router;
