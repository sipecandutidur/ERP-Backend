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
exports.generateFromQuotation = exports.addPayment = exports.createInvoice = exports.getInvoiceById = exports.getInvoices = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const math_1 = require("../utils/math");
const getInvoices = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const invoices = yield prisma_1.default.invoice.findMany({
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ status: 'success', data: { invoices } });
});
exports.getInvoices = getInvoices;
const getInvoiceById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const invoice = yield prisma_1.default.invoice.findUnique({
        where: { id },
        include: {
            customer: { include: { organization: true } },
            quotation: { include: { project: true } },
            items: { include: { item: true } },
            payments: true,
        },
    });
    if (!invoice) {
        res.status(404).json({ status: 'error', message: 'Invoice not found' });
        return;
    }
    res.status(200).json({ status: 'success', data: { invoice } });
});
exports.getInvoiceById = getInvoiceById;
const createInvoice = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { invoiceNumber, customerId, quotationId, dueDate, items, tax } = req.body;
    if (!invoiceNumber || !customerId || !items || items.length === 0) {
        res.status(400).json({ status: 'error', message: 'Missing required fields' });
        return;
    }
    const existingInvoice = yield prisma_1.default.invoice.findUnique({ where: { invoiceNumber } });
    if (existingInvoice) {
        res.status(400).json({ status: 'error', message: 'Invoice number already exists' });
        return;
    }
    let subtotal = 0;
    const processedItems = items.map((i) => {
        const total = i.quantity * i.price;
        subtotal += total;
        return {
            itemId: i.itemId,
            quantity: i.quantity,
            price: i.price,
            total,
        };
    });
    const finalTax = tax || 0;
    const total = subtotal + finalTax;
    const invoice = yield prisma_1.default.invoice.create({
        data: {
            invoiceNumber,
            customerId,
            quotationId,
            dueDate: dueDate ? new Date(dueDate) : null,
            subtotal,
            tax: finalTax,
            total,
            amountPaid: 0,
            items: { create: processedItems },
        },
        include: { items: true },
    });
    res.status(201).json({ status: 'success', data: { invoice } });
});
exports.createInvoice = createInvoice;
const addPayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params; // invoice ID
    const { paymentNumber, amount, method, reference, date } = req.body;
    if (!paymentNumber || !amount || !method) {
        res.status(400).json({ status: 'error', message: 'Missing payment fields' });
        return;
    }
    try {
        const invoice = yield prisma_1.default.invoice.findUnique({
            where: { id },
            include: {
                quotation: {
                    include: {
                        project: true
                    }
                }
            }
        });
        if (!invoice) {
            res.status(404).json({ status: 'error', message: 'Invoice not found' });
            return;
        }
        const paymentDate = date ? new Date(date) : new Date();
        const projectName = ((_b = (_a = invoice.quotation) === null || _a === void 0 ? void 0 : _a.project) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown Project';
        const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Create payment
            const payment = yield tx.payment.create({
                data: {
                    paymentNumber,
                    amount,
                    method,
                    reference,
                    date: paymentDate,
                    invoiceId: id,
                    cashFlow: {
                        create: {
                            date: paymentDate,
                            type: 'INCOME',
                            amount,
                            description: `Invoice ${invoice.invoiceNumber} - ${projectName}`,
                            category: '4101 - Pendapatan Penjualan Produk',
                        }
                    }
                },
            });
            // Update invoice amountPaid and status
            const newAmountPaid = invoice.amountPaid + amount;
            const status = newAmountPaid >= invoice.total ? 'PAID' : 'PARTIAL';
            const updatedInvoice = yield tx.invoice.update({
                where: { id },
                data: { amountPaid: newAmountPaid, status },
            });
            return { payment, invoice: updatedInvoice };
        }));
        res.status(201).json({ status: 'success', data: result });
    }
    catch (error) {
        res.status(400).json({ status: 'error', message: 'Error adding payment' });
    }
});
exports.addPayment = addPayment;
const generateFromQuotation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { quotationId } = req.params;
    const { itemIds } = req.body || {};
    try {
        const quotation = yield prisma_1.default.quotation.findUnique({
            where: { id: quotationId },
            include: { items: true }
        });
        if (!quotation) {
            res.status(404).json({ status: 'error', message: 'Quotation not found' });
            return;
        }
        if (!quotation.items || quotation.items.length === 0) {
            res.status(400).json({ status: 'error', message: 'Quotation has no items' });
            return;
        }
        // Filter items if specific IDs were provided
        const sourceItems = (itemIds && itemIds.length > 0)
            ? quotation.items.filter((i) => itemIds.includes(i.id))
            : quotation.items;
        // Generate Invoice Number INV-YYYYMM-XXXX
        const currentYearMonth = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
        const lastInvoice = yield prisma_1.default.invoice.findFirst({
            where: { invoiceNumber: { startsWith: `INV-${currentYearMonth}-` } },
            orderBy: { invoiceNumber: 'desc' },
        });
        let currentSeq = 0;
        if (lastInvoice) {
            const parts = lastInvoice.invoiceNumber.split('-');
            if (parts.length === 3) {
                currentSeq = parseInt(parts[2], 10);
                if (isNaN(currentSeq))
                    currentSeq = 0;
            }
        }
        currentSeq++;
        const invoiceNumber = `INV-${currentYearMonth}-${currentSeq.toString().padStart(4, '0')}`;
        const processedItems = sourceItems.map((i) => ({
            itemId: i.itemId,
            quantity: i.quantity,
            price: i.price,
            total: i.quantity * i.price,
        }));
        // Recalculate totals from selected items
        const subtotal = processedItems.reduce((s, i) => s + (i.total || 0), 0);
        const taxRate = quotation.subtotal > 0 ? (quotation.tax / quotation.subtotal) : 0;
        const tax = (0, math_1.bankersRound)(subtotal * taxRate);
        const total = subtotal + tax;
        const invoice = yield prisma_1.default.invoice.create({
            data: {
                invoiceNumber,
                customerId: quotation.customerId,
                quotationId: quotation.id,
                status: "UNPAID",
                subtotal,
                tax,
                total,
                amountPaid: 0,
                items: {
                    create: processedItems
                }
            },
            include: { items: { include: { item: true } }, customer: { include: { organization: true } } }
        });
        res.status(201).json({ status: 'success', data: { invoice } });
    }
    catch (error) {
        console.error("Generate invoice error:", error);
        res.status(500).json({ status: 'error', message: 'Failed to generate invoice' });
    }
});
exports.generateFromQuotation = generateFromQuotation;
