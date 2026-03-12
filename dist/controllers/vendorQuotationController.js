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
exports.generateFromQuotation = exports.updateVendorQuotationStatus = exports.createVendorQuotation = exports.getVendorQuotationById = exports.getVendorQuotations = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const math_1 = require("../utils/math");
const getVendorQuotations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const vendorQuotations = yield prisma_1.default.vendorQuotation.findMany({
        include: {
            distributor: true,
            user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: 'success', data: { vendorQuotations } });
});
exports.getVendorQuotations = getVendorQuotations;
const getVendorQuotationById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const vq = yield prisma_1.default.vendorQuotation.findUnique({
        where: { id },
        include: {
            distributor: true,
            user: { select: { id: true, name: true } },
            items: {
                include: { item: true }
            }
        },
    });
    if (!vq) {
        res.status(404).json({ status: 'error', message: 'Vendor Quotation not found' });
        return;
    }
    res.status(200).json({ status: 'success', data: { vendorQuotation: vq } });
});
exports.getVendorQuotationById = getVendorQuotationById;
const createVendorQuotation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { vqNumber, distributorId, items } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!vqNumber || !distributorId || !items || items.length === 0) {
        res.status(400).json({ status: 'error', message: 'Missing required fields' });
        return;
    }
    const existingQuote = yield prisma_1.default.vendorQuotation.findUnique({ where: { vqNumber } });
    if (existingQuote) {
        res.status(400).json({ status: 'error', message: 'Vendor Quote number already exists' });
        return;
    }
    let total = 0;
    const processedItems = items.map((i) => {
        const itemTotal = i.quantity * i.price;
        total += itemTotal;
        return {
            itemId: i.itemId,
            quantity: i.quantity,
            price: i.price,
            total: itemTotal,
        };
    });
    const vendorQuotation = yield prisma_1.default.vendorQuotation.create({
        data: {
            vqNumber,
            distributorId,
            userId,
            total,
            items: {
                create: processedItems
            }
        },
        include: { items: true },
    });
    res.status(201).json({ status: 'success', data: { vendorQuotation } });
});
exports.createVendorQuotation = createVendorQuotation;
const updateVendorQuotationStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
        res.status(400).json({ status: 'error', message: 'Status is required' });
        return;
    }
    try {
        const vendorQuotation = yield prisma_1.default.vendorQuotation.update({
            where: { id },
            data: { status },
        });
        res.status(200).json({ status: 'success', data: { vendorQuotation } });
    }
    catch (error) {
        res.status(400).json({ status: 'error', message: 'Error updating vendor quotation status' });
    }
});
exports.updateVendorQuotationStatus = updateVendorQuotationStatus;
const generateFromQuotation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { quotationId } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    // Optional: only include specific quotation item IDs
    const { itemIds } = req.body || {};
    const quotation = yield prisma_1.default.quotation.findUnique({
        where: { id: quotationId },
        include: {
            items: {
                include: {
                    item: {
                        include: { itemDistributors: true }
                    }
                }
            },
            project: true
        }
    });
    if (!quotation) {
        res.status(404).json({ status: 'error', message: 'Quotation not found' });
        return;
    }
    // Filter items if specific IDs were provided
    const sourceItems = (itemIds && itemIds.length > 0)
        ? quotation.items.filter((qi) => itemIds.includes(qi.id))
        : quotation.items;
    // Group items by distributor
    const itemsByDistributor = {};
    sourceItems.forEach((qi) => {
        if (qi.distributorId) {
            if (!itemsByDistributor[qi.distributorId]) {
                itemsByDistributor[qi.distributorId] = [];
            }
            let basePrice = 0;
            let tax = 0;
            const distInfo = qi.item.itemDistributors.find((d) => d.distributorId === qi.distributorId);
            if (distInfo) {
                basePrice = distInfo.basePrice || 0;
                tax = distInfo.tax || 0;
            }
            // Calculation logic based on item parameters
            const rowSubtotal = basePrice * qi.quantity;
            const rowTaxAmount = (0, math_1.bankersRound)(rowSubtotal * (tax / 100));
            const rowFinalTotal = rowSubtotal + rowTaxAmount;
            itemsByDistributor[qi.distributorId].push({
                itemId: qi.itemId,
                quantity: qi.quantity,
                price: basePrice, // Store absolute base price
                total: rowFinalTotal,
            });
        }
    });
    // Get highest sequence number for current month
    const currentYearMonth = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const lastVq = yield prisma_1.default.vendorQuotation.findFirst({
        where: { vqNumber: { startsWith: `VQ-${currentYearMonth}-` } },
        orderBy: { vqNumber: 'desc' },
    });
    let currentSeq = 0;
    if (lastVq) {
        const parts = lastVq.vqNumber.split('-');
        if (parts.length === 3) {
            currentSeq = parseInt(parts[2], 10);
            if (isNaN(currentSeq))
                currentSeq = 0;
        }
    }
    const generatedQuotes = [];
    for (const distributorId of Object.keys(itemsByDistributor)) {
        const items = itemsByDistributor[distributorId];
        // Auto-generate VQ Number
        currentSeq++;
        const vqNum = `VQ-${currentYearMonth}-${currentSeq.toString().padStart(4, '0')}`;
        const total = items.reduce((sum, item) => sum + item.total, 0);
        const vendorQuote = yield prisma_1.default.vendorQuotation.create({
            data: {
                vqNumber: vqNum,
                distributorId,
                userId,
                projectCode: ((_b = quotation.project) === null || _b === void 0 ? void 0 : _b.code) || null,
                total,
                items: {
                    create: items,
                }
            }
        });
        generatedQuotes.push(vendorQuote);
    }
    res.status(201).json({ status: 'success', data: { generatedQuotes } });
});
exports.generateFromQuotation = generateFromQuotation;
