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
exports.createTransaction = exports.getTransactions = exports.getFinancialSummary = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const getFinancialSummary = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Total Revenue (Paid + Partial from AmountPaid)
        const invoices = yield prisma_1.default.invoice.findMany({
            select: {
                total: true,
                amountPaid: true,
                status: true,
            }
        });
        let totalRevenue = 0;
        let totalReceivables = 0; // Unpaid amounts
        invoices.forEach((inv) => {
            totalRevenue += inv.amountPaid;
            totalReceivables += (inv.total - inv.amountPaid);
        });
        // Total expenses could be calculated from Vendor Quotations or a separate Expenses model.
        // Assuming confirmed Vendor Quotes mean ordered & paid for basic logic
        const vendorQuotes = yield prisma_1.default.vendorQuotation.findMany({
            where: { status: 'CONFIRMED' },
            select: { total: true }
        });
        let totalExpenses = 0;
        vendorQuotes.forEach((vq) => {
            totalExpenses += vq.total;
        });
        const netProfit = totalRevenue - totalExpenses;
        const summary = {
            totalRevenue,
            totalReceivables,
            totalExpenses,
            netProfit,
        };
        res.status(200).json({ status: 'success', data: { summary } });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to generate financial summary' });
    }
});
exports.getFinancialSummary = getFinancialSummary;
const getTransactions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { month, year } = req.query;
        let dateFilter = {};
        if (month && year && month !== 'ALL' && year !== 'ALL') {
            const startDate = new Date(Number(year), Number(month) - 1, 1);
            const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
            dateFilter = {
                date: {
                    gte: startDate,
                    lte: endDate,
                }
            };
        }
        else if (year && year !== 'ALL') {
            const startDate = new Date(Number(year), 0, 1);
            const endDate = new Date(Number(year), 11, 31, 23, 59, 59, 999);
            dateFilter = {
                date: {
                    gte: startDate,
                    lte: endDate,
                }
            };
        }
        const transactions = yield prisma_1.default.cashFlowTransaction.findMany({
            where: dateFilter,
            orderBy: { date: 'desc' },
            include: {
                expense: { select: { expenseNumber: true } },
                payment: { select: { paymentNumber: true, invoice: { select: { invoiceNumber: true } } } }
            }
        });
        const income = yield prisma_1.default.cashFlowTransaction.aggregate({
            where: Object.assign({ type: 'INCOME' }, dateFilter),
            _sum: { amount: true }
        });
        const expense = yield prisma_1.default.cashFlowTransaction.aggregate({
            where: Object.assign({ type: 'EXPENSE' }, dateFilter),
            _sum: { amount: true }
        });
        const totalIncome = income._sum.amount || 0;
        const totalExpense = expense._sum.amount || 0;
        const balance = totalIncome - totalExpense;
        res.status(200).json({
            status: 'success',
            data: {
                transactions,
                summary: { totalIncome, totalExpense, balance }
            }
        });
    }
    catch (error) {
        console.error("Fetch transactions error:", error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch transactions' });
    }
});
exports.getTransactions = getTransactions;
const createTransaction = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { date, type, amount, description, category } = req.body;
    if (!type || !amount || !description) {
        res.status(400).json({ status: 'error', message: 'Missing required fields' });
        return;
    }
    try {
        const transaction = yield prisma_1.default.cashFlowTransaction.create({
            data: {
                date: date ? new Date(date) : new Date(),
                type,
                amount,
                description,
                category,
            }
        });
        res.status(201).json({ status: 'success', data: { transaction } });
    }
    catch (error) {
        console.error("Create manual transaction error:", error);
        res.status(500).json({ status: 'error', message: 'Failed to record transaction' });
    }
});
exports.createTransaction = createTransaction;
