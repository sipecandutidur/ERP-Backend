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
exports.updateDeliveryNoteItem = exports.generateFromQuotation = exports.updateDeliveryNoteStatus = exports.createDeliveryNote = exports.getDeliveryNoteById = exports.getDeliveryNotes = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const getDeliveryNotes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const deliveryNotes = yield prisma_1.default.deliveryNote.findMany({
        include: {
            quotation: {
                include: { customer: true }
            }
        },
        orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ status: 'success', data: { deliveryNotes } });
});
exports.getDeliveryNotes = getDeliveryNotes;
const getDeliveryNoteById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const deliveryNote = yield prisma_1.default.deliveryNote.findUnique({
        where: { id },
        include: {
            quotation: {
                include: {
                    customer: {
                        include: { organization: true }
                    },
                    project: true // Include project data
                }
            },
            items: {
                include: { item: true }
            }
        },
    });
    if (!deliveryNote) {
        res.status(404).json({ status: 'error', message: 'Delivery Note not found' });
        return;
    }
    res.status(200).json({ status: 'success', data: { deliveryNote } });
});
exports.getDeliveryNoteById = getDeliveryNoteById;
const createDeliveryNote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { dnNumber, quotationId, driverName, vehicleNumber, items } = req.body;
    if (!dnNumber || !items || items.length === 0) {
        res.status(400).json({ status: 'error', message: 'dnNumber and items are required' });
        return;
    }
    const existingDn = yield prisma_1.default.deliveryNote.findUnique({ where: { dnNumber } });
    if (existingDn) {
        res.status(400).json({ status: 'error', message: 'Delivery Note number already exists' });
        return;
    }
    const processedItems = items.map((i) => ({
        itemId: i.itemId,
        quantityLoad: i.quantityLoad,
        quantitySent: i.quantitySent || i.quantityLoad, // default equals to load
    }));
    const deliveryNote = yield prisma_1.default.deliveryNote.create({
        data: {
            dnNumber,
            quotationId,
            driverName,
            vehicleNumber,
            items: {
                create: processedItems,
            }
        },
        include: { items: true },
    });
    res.status(201).json({ status: 'success', data: { deliveryNote } });
});
exports.createDeliveryNote = createDeliveryNote;
const updateDeliveryNoteStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
        res.status(400).json({ status: 'error', message: 'Status is required' });
        return;
    }
    try {
        const deliveryNote = yield prisma_1.default.deliveryNote.update({
            where: { id },
            data: { status },
        });
        res.status(200).json({ status: 'success', data: { deliveryNote } });
    }
    catch (error) {
        res.status(400).json({ status: 'error', message: 'Error updating delivery note status' });
    }
});
exports.updateDeliveryNoteStatus = updateDeliveryNoteStatus;
const generateFromQuotation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { quotationId } = req.params;
    const { itemIds } = req.body || {};
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
    // Get highest sequence number for current month
    const currentYearMonth = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const lastDn = yield prisma_1.default.deliveryNote.findFirst({
        where: { dnNumber: { startsWith: `DN-${currentYearMonth}-` } },
        orderBy: { dnNumber: 'desc' },
    });
    let currentSeq = 0;
    if (lastDn) {
        const parts = lastDn.dnNumber.split('-');
        if (parts.length === 3) {
            currentSeq = parseInt(parts[2], 10);
            if (isNaN(currentSeq))
                currentSeq = 0;
        }
    }
    currentSeq++;
    const dnNumber = `DN-${currentYearMonth}-${currentSeq.toString().padStart(4, '0')}`;
    const processedItems = sourceItems.map((i) => ({
        itemId: i.itemId,
        quantityLoad: i.quantity,
        quantitySent: i.quantity,
    }));
    const deliveryNote = yield prisma_1.default.deliveryNote.create({
        data: {
            dnNumber,
            quotationId: quotation.id,
            status: "PENDING",
            items: {
                create: processedItems
            }
        },
        include: { items: true }
    });
    res.status(201).json({ status: 'success', data: { deliveryNote } });
});
exports.generateFromQuotation = generateFromQuotation;
const updateDeliveryNoteItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, itemId } = req.params;
    const { quantitySent, note } = req.body;
    try {
        const item = yield prisma_1.default.deliveryNoteItem.update({
            where: {
                id: itemId,
                deliveryNoteId: id, // Ensure item belongs to this DN
            },
            data: {
                quantitySent: quantitySent !== undefined ? Number(quantitySent) : undefined,
                note: note !== undefined ? String(note) : undefined,
            }
        });
        res.status(200).json({ status: 'success', data: { item } });
    }
    catch (error) {
        res.status(400).json({ status: 'error', message: 'Error updating delivery note item' });
    }
});
exports.updateDeliveryNoteItem = updateDeliveryNoteItem;
