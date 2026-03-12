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
exports.updateQuotationStatus = exports.updateQuotation = exports.createQuotation = exports.getQuotationById = exports.getQuotations = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const math_1 = require("../utils/math");
const getQuotations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const quotations = yield prisma_1.default.quotation.findMany({
        include: {
            customer: true,
            project: true,
            user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: 'success', data: { quotations } });
});
exports.getQuotations = getQuotations;
const getQuotationById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const quotation = yield prisma_1.default.quotation.findUnique({
        where: { id },
        include: {
            customer: { include: { organization: true } },
            project: { include: { customer: { include: { organization: true } } } },
            user: { select: { id: true, name: true } },
            items: {
                include: {
                    item: {
                        include: { itemDistributors: true }
                    },
                    distributor: true
                }
            }
        },
    });
    if (!quotation) {
        res.status(404).json({ status: 'error', message: 'Quotation not found' });
        return;
    }
    res.status(200).json({ status: 'success', data: { quotation } });
});
exports.getQuotationById = getQuotationById;
const createQuotation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { customerId, projectId, items, discount, tax, date, validUntil } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!customerId || !items || items.length === 0) {
        res.status(400).json({ status: 'error', message: 'Missing required fields' });
        return;
    }
    const count = yield prisma_1.default.quotation.count();
    const quoteNumber = `QUO-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(count + 1).toString().padStart(4, '0')}`;
    // Calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    const processedItems = items.map((i) => {
        var _a, _b;
        // Frontend sends 'unitPrice', but schema holds 'price'
        const actualPrice = (_b = (_a = i.unitPrice) !== null && _a !== void 0 ? _a : i.price) !== null && _b !== void 0 ? _b : 0;
        const itemDiscount = i.discount || 0;
        const itemTax = i.tax || 0;
        const rowSubtotal = i.quantity * actualPrice;
        const rowDiscAmount = (0, math_1.bankersRound)(rowSubtotal * (itemDiscount / 100));
        const rowAfterDisc = rowSubtotal - rowDiscAmount;
        const rowTaxAmount = (0, math_1.bankersRound)(rowAfterDisc * (itemTax / 100));
        const rowFinalTotal = rowAfterDisc; // Tax is collected globally, not inside row total
        subtotal += rowSubtotal;
        totalDiscount += rowDiscAmount;
        totalTax += rowTaxAmount;
        return {
            itemId: i.itemId,
            distributorId: i.distributorId || null,
            quantity: i.quantity,
            price: actualPrice,
            availability: i.availability || null,
            tax: itemTax,
            total: rowFinalTotal,
        };
    });
    const total = subtotal - totalDiscount + totalTax;
    const quotation = yield prisma_1.default.quotation.create({
        data: {
            quoteNumber,
            customerId,
            projectId,
            userId,
            date: date ? new Date(date) : new Date(),
            validUntil: validUntil ? new Date(validUntil) : null,
            subtotal,
            discount: totalDiscount,
            tax: totalTax,
            total,
            items: {
                create: processedItems
            }
        },
        include: { items: true },
    });
    res.status(201).json({ status: 'success', data: { quotation } });
});
exports.createQuotation = createQuotation;
const updateQuotation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { customerId, projectId, items, discount, tax, date, validUntil } = req.body;
    if (!customerId || !items || items.length === 0) {
        res.status(400).json({ status: 'error', message: 'Missing required fields' });
        return;
    }
    // Calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    const processedItems = items.map((i) => {
        var _a, _b;
        // Frontend sends 'unitPrice', but schema holds 'price'
        const actualPrice = (_b = (_a = i.unitPrice) !== null && _a !== void 0 ? _a : i.price) !== null && _b !== void 0 ? _b : 0;
        const itemDiscount = i.discount || 0;
        const itemTax = i.tax || 0;
        const rowSubtotal = i.quantity * actualPrice;
        const rowDiscAmount = (0, math_1.bankersRound)(rowSubtotal * (itemDiscount / 100));
        const rowAfterDisc = rowSubtotal - rowDiscAmount;
        const rowTaxAmount = (0, math_1.bankersRound)(rowAfterDisc * (itemTax / 100));
        const rowFinalTotal = rowAfterDisc; // Tax is collected globally, not inside row total
        subtotal += rowSubtotal;
        totalDiscount += rowDiscAmount;
        totalTax += rowTaxAmount;
        return {
            itemId: i.itemId,
            distributorId: i.distributorId || null,
            quantity: i.quantity,
            price: actualPrice,
            availability: i.availability || null,
            tax: itemTax,
            total: rowFinalTotal,
        };
    });
    const total = subtotal - totalDiscount + totalTax;
    try {
        const quotation = yield prisma_1.default.quotation.update({
            where: { id },
            data: {
                customerId,
                projectId,
                date: date ? new Date(date) : undefined,
                validUntil: validUntil ? new Date(validUntil) : null,
                subtotal,
                discount: totalDiscount,
                tax: totalTax,
                total,
                items: {
                    deleteMany: {}, // Remove all existing items
                    create: processedItems // Add the new items
                }
            },
            include: { items: true },
        });
        res.status(200).json({ status: 'success', data: { quotation } });
    }
    catch (error) {
        console.error('Error updating quotation:', error);
        res.status(400).json({ status: 'error', message: `Error updating quotation: ${error.message || error}` });
    }
});
exports.updateQuotation = updateQuotation;
const updateQuotationStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
        res.status(400).json({ status: 'error', message: 'Status is required' });
        return;
    }
    try {
        const quotation = yield prisma_1.default.quotation.update({
            where: { id },
            data: { status },
        });
        res.status(200).json({ status: 'success', data: { quotation } });
    }
    catch (error) {
        res.status(400).json({ status: 'error', message: 'Error updating quotation status' });
    }
});
exports.updateQuotationStatus = updateQuotationStatus;
