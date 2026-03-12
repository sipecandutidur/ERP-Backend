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
exports.generateFromQuotation = exports.updatePurchaseOrderItemStatus = exports.updatePurchaseOrderStatus = exports.getPurchaseOrderById = exports.getPurchaseOrders = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const math_1 = require("../utils/math");
const getPurchaseOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const purchaseOrders = yield prisma_1.default.purchaseOrder.findMany({
        include: {
            distributor: true,
            user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: 'success', data: { purchaseOrders } });
});
exports.getPurchaseOrders = getPurchaseOrders;
const getPurchaseOrderById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const po = yield prisma_1.default.purchaseOrder.findUnique({
        where: { id },
        include: {
            distributor: true,
            user: { select: { id: true, name: true } },
            items: {
                include: { item: true }
            }
        },
    });
    if (!po) {
        res.status(404).json({ status: 'error', message: 'Purchase Order not found' });
        return;
    }
    res.status(200).json({ status: 'success', data: { purchaseOrder: po } });
});
exports.getPurchaseOrderById = getPurchaseOrderById;
const updatePurchaseOrderStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
        res.status(400).json({ status: 'error', message: 'Status is required' });
        return;
    }
    try {
        const purchaseOrder = yield prisma_1.default.purchaseOrder.update({
            where: { id },
            data: { status },
        });
        res.status(200).json({ status: 'success', data: { purchaseOrder } });
    }
    catch (error) {
        res.status(400).json({ status: 'error', message: 'Error updating purchase order status' });
    }
});
exports.updatePurchaseOrderStatus = updatePurchaseOrderStatus;
const updatePurchaseOrderItemStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, itemId } = req.params;
    const { fulfillmentStatus } = req.body;
    if (!fulfillmentStatus) {
        res.status(400).json({ status: 'error', message: 'Fulfillment status is required' });
        return;
    }
    try {
        const item = yield prisma_1.default.purchaseOrderItem.update({
            where: { id: itemId, purchaseOrderId: id },
            data: { fulfillmentStatus },
        });
        res.status(200).json({ status: 'success', data: { item } });
    }
    catch (error) {
        res.status(400).json({ status: 'error', message: 'Error updating item fulfillment status' });
    }
});
exports.updatePurchaseOrderItemStatus = updatePurchaseOrderItemStatus;
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
            let taxRate = 0;
            const distInfo = qi.item.itemDistributors.find((d) => d.distributorId === qi.distributorId);
            if (distInfo) {
                basePrice = distInfo.basePrice || 0;
                taxRate = distInfo.tax || 0;
            }
            // Calculation logic based on item parameters
            const rowSubtotal = basePrice * qi.quantity;
            const rowTaxAmount = (0, math_1.bankersRound)(rowSubtotal * (taxRate / 100));
            const rowFinalTotal = rowSubtotal + rowTaxAmount;
            itemsByDistributor[qi.distributorId].push({
                itemId: qi.itemId,
                quantity: qi.quantity,
                price: basePrice, // Store absolute base price
                total: rowSubtotal, // Item total is just Qty * Unit Price
                taxAmount: rowTaxAmount, // Add tax object for Grand Total sum
            });
        }
    });
    // Get highest sequence number for current month
    const currentYearMonth = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const lastPo = yield prisma_1.default.purchaseOrder.findFirst({
        where: { poNumber: { startsWith: `PO-${currentYearMonth}-` } },
        orderBy: { poNumber: 'desc' },
    });
    let currentSeq = 0;
    if (lastPo) {
        const parts = lastPo.poNumber.split('-');
        if (parts.length === 3) {
            currentSeq = parseInt(parts[2], 10);
            if (isNaN(currentSeq))
                currentSeq = 0;
        }
    }
    const generatedPOs = [];
    for (const distributorId of Object.keys(itemsByDistributor)) {
        const items = itemsByDistributor[distributorId];
        // Auto-generate PO Number
        currentSeq++;
        const poNum = `PO-${currentYearMonth}-${currentSeq.toString().padStart(4, '0')}`;
        const total = items.reduce((sum, item) => sum + item.total + item.taxAmount, 0);
        // Filter out the taxAmount helper property before database insertion
        const itemsData = items.map((i) => ({
            itemId: i.itemId,
            quantity: i.quantity,
            price: i.price,
            total: i.total
        }));
        const po = yield prisma_1.default.purchaseOrder.create({
            data: {
                poNumber: poNum,
                distributorId,
                userId,
                projectCode: ((_b = quotation.project) === null || _b === void 0 ? void 0 : _b.code) || null,
                total,
                items: {
                    create: itemsData,
                }
            }
        });
        generatedPOs.push(po);
    }
    res.status(201).json({ status: 'success', data: { generatedPurchaseOrders: generatedPOs } });
});
exports.generateFromQuotation = generateFromQuotation;
