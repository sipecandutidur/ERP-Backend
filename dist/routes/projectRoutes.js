"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const projectController_1 = require("../controllers/projectController");
const rabController_1 = require("../controllers/rabController");
const expenseController_1 = require("../controllers/expenseController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/projects/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({ storage });
const router = express_1.default.Router();
router.use(authMiddleware_1.authenticate);
router.get('/', projectController_1.getProjects);
router.get('/pipeline', projectController_1.getPipelineProjects); // Must be before /:id
router.get('/:id', projectController_1.getProjectById);
router.post('/', projectController_1.createProject);
router.put('/:id', projectController_1.updateProject);
router.patch('/:id/stage', projectController_1.updateProjectStage);
router.delete('/:id', projectController_1.deleteProject);
// Documents
router.get('/:id/documents', projectController_1.getProjectDocuments);
router.post('/:id/documents/upload', upload.single('file'), projectController_1.uploadProjectDocument);
router.delete('/documents/:docId', projectController_1.deleteProjectDocument);
// RAB
router.get('/:id/rab', rabController_1.getRABByProject);
router.post('/:id/rab/generate', rabController_1.generateRABFromQuotation);
router.post('/:id/rab/items', rabController_1.addRABItem);
router.put('/rab-items/:id', rabController_1.updateRABItem);
router.delete('/rab-items/:id', rabController_1.deleteRABItem);
// Expenses
router.get('/:id/expenses', expenseController_1.getExpensesByProject);
router.post('/:id/expenses', expenseController_1.createExpense);
router.put('/expenses/:id', expenseController_1.updateExpense);
router.delete('/expenses/:id', expenseController_1.deleteExpense);
exports.default = router;
