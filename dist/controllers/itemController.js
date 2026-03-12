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
exports.importItems = exports.deleteItem = exports.updateItem = exports.createItem = exports.getItemById = exports.getItems = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const getItems = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const items = yield prisma_1.default.item.findMany({
        include: {
            itemDistributors: {
                include: { distributor: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: 'success', data: { items } });
});
exports.getItems = getItems;
const getItemById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const item = yield prisma_1.default.item.findUnique({
        where: { id },
        include: {
            itemDistributors: {
                include: { distributor: true }
            }
        },
    });
    if (!item) {
        res.status(404).json({ status: 'error', message: 'Item not found' });
        return;
    }
    res.status(200).json({ status: 'success', data: { item } });
});
exports.getItemById = getItemById;
const createItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let { code, name, description, category, unit, stock, itemDistributors } = req.body;
    if (!name || !unit) {
        res.status(400).json({ status: 'error', message: 'Name and unit are required' });
        return;
    }
    if (code) {
        // If user provided code manually
        const existingItem = yield prisma_1.default.item.findUnique({ where: { code } });
        if (existingItem) {
            res.status(400).json({ status: 'error', message: 'Item code already exists' });
            return;
        }
    }
    else {
        // Auto-generate code
        const count = yield prisma_1.default.item.count();
        code = `ITEM-${(count + 1).toString().padStart(4, '0')}`;
    }
    const distributorsData = Array.isArray(itemDistributors) ? itemDistributors.map((d) => ({
        distributorId: d.distributorId,
        basePrice: Number(d.basePrice) || 0,
        discount: Number(d.discount) || 0,
        tax: Number(d.tax) || 0,
        margin: Number(d.margin) || 0,
        sellPrice: Number(d.sellPrice) || 0,
    })) : [];
    const item = yield prisma_1.default.item.create({
        data: {
            code,
            name,
            description,
            category,
            unit,
            stock: stock || 0,
            itemDistributors: {
                create: distributorsData
            }
        },
        include: { itemDistributors: { include: { distributor: true } } },
    });
    res.status(201).json({ status: 'success', data: { item } });
});
exports.createItem = createItem;
const updateItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { code, name, description, category, unit, stock, itemDistributors } = req.body;
    const dataToUpdate = {};
    if (code)
        dataToUpdate.code = code;
    if (name)
        dataToUpdate.name = name;
    if (description !== undefined)
        dataToUpdate.description = description;
    if (category !== undefined)
        dataToUpdate.category = category;
    if (unit)
        dataToUpdate.unit = unit;
    if (stock !== undefined)
        dataToUpdate.stock = stock;
    try {
        const itemToUpdate = yield prisma_1.default.item.findUnique({ where: { id } });
        if (!itemToUpdate) {
            res.status(404).json({ status: 'error', message: 'Item not found' });
            return;
        }
        // Prepare update data
        const updateData = Object.assign({}, dataToUpdate);
        // Handle nested ItemDistributor sync
        if (Array.isArray(itemDistributors)) {
            // First delete all existing distributors for this item
            yield prisma_1.default.itemDistributor.deleteMany({
                where: { itemId: id }
            });
            // Then recreate them
            updateData.itemDistributors = {
                create: itemDistributors.map((d) => ({
                    distributorId: d.distributorId,
                    basePrice: Number(d.basePrice) || 0,
                    discount: Number(d.discount) || 0,
                    tax: Number(d.tax) || 0,
                    margin: Number(d.margin) || 0,
                    sellPrice: Number(d.sellPrice) || 0,
                }))
            };
        }
        const updatedItem = yield prisma_1.default.item.update({
            where: { id },
            data: updateData,
            include: { itemDistributors: { include: { distributor: true } } },
        });
        res.status(200).json({ status: 'success', data: { item: updatedItem } });
    }
    catch (error) {
        console.error(error);
        res.status(400).json({ status: 'error', message: 'Error updating item' });
    }
});
exports.updateItem = updateItem;
const deleteItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield prisma_1.default.item.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        res.status(400).json({ status: 'error', message: 'Error deleting item or related records exist' });
    }
});
exports.deleteItem = deleteItem;
const importItems = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { items } = req.body;
    if (!Array.isArray(items)) {
        res.status(400).json({ status: 'error', message: 'Payload must be an array of items' });
        return;
    }
    try {
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            for (const itemPayload of items) {
                const { code, name, description, category, unit, stock, itemDistributors } = itemPayload;
                if (!name || !unit)
                    continue; // Skip invalid rows safely
                const distributorsData = Array.isArray(itemDistributors) ? itemDistributors.map((d) => ({
                    distributorId: d.distributorId,
                    basePrice: Number(d.basePrice) || 0,
                    discount: Number(d.discount) || 0,
                    tax: Number(d.tax) || 0,
                    margin: Number(d.margin) || 0,
                    sellPrice: Number(d.sellPrice) || 0,
                })) : [];
                let finalCode = code;
                if (!finalCode) {
                    const count = yield tx.item.count();
                    // generate a random enough code fallback to avoid collisions in bulk
                    finalCode = `ITEM-${Date.now().toString().slice(-4)}-${(count + 1).toString().padStart(4, '0')}`;
                }
                // Check exist by exact code
                const existingInfo = yield tx.item.findUnique({ where: { code: finalCode } });
                if (existingInfo) {
                    // Update existing item
                    yield tx.itemDistributor.deleteMany({ where: { itemId: existingInfo.id } });
                    yield tx.item.update({
                        where: { id: existingInfo.id },
                        data: {
                            name: name || existingInfo.name,
                            description: description || existingInfo.description,
                            category: category || existingInfo.category,
                            unit: unit || existingInfo.unit,
                            stock: stock !== undefined ? Number(stock) : existingInfo.stock,
                            itemDistributors: { create: distributorsData }
                        }
                    });
                }
                else {
                    // Create new item
                    yield tx.item.create({
                        data: {
                            code: finalCode,
                            name,
                            description: description || '',
                            category: category || 'General',
                            unit,
                            stock: Number(stock) || 0,
                            itemDistributors: { create: distributorsData }
                        }
                    });
                }
            }
        }));
        res.status(200).json({ status: 'success', message: `${items.length} items processed` });
    }
    catch (err) {
        console.error('Import Error:', err);
        res.status(500).json({ status: 'error', message: err.message || 'Bulk import failed' });
    }
});
exports.importItems = importItems;
