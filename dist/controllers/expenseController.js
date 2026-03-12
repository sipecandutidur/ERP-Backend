"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteExpense = exports.updateExpense = exports.createExpense = exports.getExpensesByProject = void 0;
const prisma_1 = __importDefault(require("../prisma"));
// Get Expenses by Project ID
const getExpensesByProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id: projectId } = req.params;
        const expenses = yield prisma_1.default.expense.findMany({
            where: { projectId },
            orderBy: { date: 'desc' },
        });
        res.json({ success: true, data: expenses });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.getExpensesByProject = getExpensesByProject;
// Create Expense
const createExpense = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id: projectId } = req.params;
        const { expenseNumber, date, description, amount, category, receipt } = req.body;
        // Check unique expense number
        if (expenseNumber) {
            const existing = yield prisma_1.default.expense.findUnique({ where: { expenseNumber } });
            if (existing) {
                res.status(400).json({ success: false, message: 'Expense Number must be unique' });
                return;
            }
        }
        // Auto-generate if empty
        const generateNumber = () => {
            const dateObj = new Date();
            return `EXP-${dateObj.getFullYear().toString().substring(2)}${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        };
        const finalExpenseNumber = expenseNumber || generateNumber();
        const expense = yield prisma_1.default.expense.create({
            data: {
                projectId,
                expenseNumber: finalExpenseNumber,
                date: date ? new Date(date) : new Date(),
                description,
                amount: Number(amount),
                category,
                receipt,
                cashFlow: {
                    create: {
                        date: date ? new Date(date) : new Date(),
                        type: 'EXPENSE',
                        amount: Number(amount),
                        description: `Expense: ${finalExpenseNumber} - ${description}`,
                        category: category || '5210 - Beban Lain-lain',
                    }
                }
            },
        });
        res.status(201).json({ success: true, data: expense });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.createExpense = createExpense;
// Update Expense
const updateExpense = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { expenseNumber, date, description, amount, category, receipt } = req.body;
        const expense = yield prisma_1.default.expense.update({
            where: { id },
            data: {
                expenseNumber,
                date: date ? new Date(date) : undefined,
                description,
                amount: Number(amount),
                category,
                receipt,
            },
        });
        res.json({ success: true, data: expense });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.updateExpense = updateExpense;
// Delete Expense
const deleteExpense = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield prisma_1.default.expense.delete({
            where: { id },
        });
        res.json({ success: true, message: 'Expense deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.deleteExpense = deleteExpense;
