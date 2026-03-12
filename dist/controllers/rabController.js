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
exports.deleteRABItem = exports.updateRABItem = exports.generateRABFromQuotation = exports.addRABItem = exports.getRABByProject = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const getRABByProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id: projectId } = req.params;
        let rab = yield prisma_1.default.rAB.findUnique({
            where: { projectId },
            include: { items: true },
        });
        if (!rab) {
            // Auto-create an empty RAB if none exists when requested
            rab = yield prisma_1.default.rAB.create({
                data: { projectId },
                include: { items: true },
            });
        }
        res.json({ success: true, data: rab });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.getRABByProject = getRABByProject;
// Add RAB Item
const addRABItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id: projectId } = req.params;
        const { description, quantity, unit, unitPrice, status, supplier } = req.body;
        let rab = yield prisma_1.default.rAB.findUnique({ where: { projectId } });
        if (!rab) {
            rab = yield prisma_1.default.rAB.create({ data: { projectId } });
        }
        const totalPrice = Number(quantity) * Number(unitPrice);
        const newItem = yield prisma_1.default.rABItem.create({
            data: {
                rabId: rab.id,
                description,
                quantity: Number(quantity),
                unit,
                unitPrice: Number(unitPrice),
                totalPrice,
                status: status || "REQUEST",
                supplier: supplier || null,
            },
        });
        // Update total estimated cost
        const updatedRab = yield prisma_1.default.rAB.findUnique({
            where: { id: rab.id },
            include: { items: true }
        });
        const newTotal = (updatedRab === null || updatedRab === void 0 ? void 0 : updatedRab.items.reduce((sum, item) => sum + item.totalPrice, 0)) || 0;
        yield prisma_1.default.rAB.update({
            where: { id: rab.id },
            data: { totalEstimatedCost: newTotal }
        });
        res.status(201).json({ success: true, data: newItem });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.addRABItem = addRABItem;
// Auto-generate RAB from Linked Quotations
const generateRABFromQuotation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id: projectId } = req.params;
        // Find the latest accepted or sent quotation for the project, or at least any quotation tied to this project
        const quotation = yield prisma_1.default.quotation.findFirst({
            where: { projectId },
            orderBy: { date: 'desc' },
            include: {
                items: {
                    include: {
                        distributor: true, // we need distributor to lookup ItemDistributor
                        item: true, // fetch item details directly from the relation
                    }
                }
            }
        });
        if (!quotation) {
            console.log(`[RAB Generate] No quotation found for project ${projectId}`);
            res.status(404).json({ success: false, message: 'No Quotation found linked to this project. Please link a quotation first.' });
            return;
        }
        console.log(`[RAB Generate] Found Quotation ${quotation.id} with ${quotation.items.length} items`);
        // Ensure we have an active RAB for this project
        let rab = yield prisma_1.default.rAB.findUnique({ where: { projectId } });
        if (!rab) {
            rab = yield prisma_1.default.rAB.create({ data: { projectId } });
        }
        // Clear existing RAB items to prevent duplicates when regenerating
        yield prisma_1.default.rABItem.deleteMany({
            where: { rabId: rab.id }
        });
        // Lookup ItemDistributor for each QuotationItem to compute Unit Cost
        const rabItemPromises = quotation.items.map((qItem) => __awaiter(void 0, void 0, void 0, function* () {
            let unitCost = qItem.price; // fallback to the selling price if no distributor data is found
            let description = qItem.item ? qItem.item.name : 'Material'; // Fallback descriptive name
            let suppName = "";
            // Use the pre-fetched item from the relation
            const itemNode = qItem.item;
            if (itemNode) {
                description = itemNode.name;
                if (itemNode.code) {
                    description = `[${itemNode.code}] ${description}`;
                }
                // If distributor is mapped, try to fetch the backend modal/base price
                if (qItem.distributorId) {
                    const itemDistributor = yield prisma_1.default.itemDistributor.findUnique({
                        where: {
                            itemId_distributorId: {
                                itemId: qItem.itemId,
                                distributorId: qItem.distributorId
                            }
                        },
                        include: { distributor: true } // We need to fetch the distributor details specifically for the name
                    });
                    if (itemDistributor) {
                        suppName = itemDistributor.distributor.name;
                        description += ` - ${suppName}`;
                        // Formula: Unit Price = (Base Price - (Base Price * (Discount / 100))) * (1 + (Tax / 100))
                        const basePrice = itemDistributor.basePrice;
                        const discountPct = itemDistributor.discount;
                        const taxPct = itemDistributor.tax;
                        const netPrice = basePrice - (basePrice * (discountPct / 100));
                        // User requested tax to be applied. Some apply tax additively on net.
                        // Formula specified: (Base Price - (Base Price*Disc%)) + ((Base Price - (Base Price*Disc%)) * Tax%)
                        const taxYield = netPrice * (taxPct / 100);
                        unitCost = netPrice + taxYield;
                    }
                }
            }
            const totalPrice = unitCost * qItem.quantity;
            // We don't want to duplicate items if they're already generated, but for simplicity we'll just append for now.
            // Easiest is to create new RAB items
            return prisma_1.default.rABItem.create({
                data: {
                    rabId: rab.id,
                    description: description,
                    quantity: qItem.quantity,
                    unit: (itemNode === null || itemNode === void 0 ? void 0 : itemNode.unit) || "Unit",
                    unitPrice: unitCost,
                    totalPrice: totalPrice,
                    supplier: suppName || null,
                }
            });
        }));
        yield Promise.all(rabItemPromises);
        // Update total estimated cost
        const updatedRab = yield prisma_1.default.rAB.findUnique({
            where: { id: rab.id },
            include: { items: true }
        });
        const newTotal = (updatedRab === null || updatedRab === void 0 ? void 0 : updatedRab.items.reduce((sum, item) => sum + item.totalPrice, 0)) || 0;
        yield prisma_1.default.rAB.update({
            where: { id: rab.id },
            data: { totalEstimatedCost: newTotal }
        });
        console.log(`[RAB Generate] Successfully generated ${rabItemPromises.length} items. New total: ${newTotal}`);
        res.status(200).json({ success: true, message: 'RAB successfully generated from Quotation', data: updatedRab });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.generateRABFromQuotation = generateRABFromQuotation;
// Update RAB Item
const updateRABItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { description, quantity, unit, unitPrice, status, supplier } = req.body;
        const totalPrice = Number(quantity) * Number(unitPrice);
        const updatedItem = yield prisma_1.default.rABItem.update({
            where: { id },
            data: {
                description,
                quantity: Number(quantity),
                unit,
                unitPrice: Number(unitPrice),
                totalPrice,
                status,
                supplier,
            },
        });
        // Update total
        const rab = yield prisma_1.default.rAB.findUnique({
            where: { id: updatedItem.rabId },
            include: { items: true }
        });
        const newTotal = (rab === null || rab === void 0 ? void 0 : rab.items.reduce((sum, item) => sum + item.totalPrice, 0)) || 0;
        yield prisma_1.default.rAB.update({
            where: { id: updatedItem.rabId },
            data: { totalEstimatedCost: newTotal }
        });
        res.json({ success: true, data: updatedItem });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.updateRABItem = updateRABItem;
// Delete RAB Item
const deleteRABItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const item = yield prisma_1.default.rABItem.delete({
            where: { id },
        });
        // Update total
        const rab = yield prisma_1.default.rAB.findUnique({
            where: { id: item.rabId },
            include: { items: true }
        });
        const newTotal = (rab === null || rab === void 0 ? void 0 : rab.items.reduce((sum, i) => sum + i.totalPrice, 0)) || 0;
        yield prisma_1.default.rAB.update({
            where: { id: item.rabId },
            data: { totalEstimatedCost: newTotal }
        });
        res.json({ success: true, message: 'RAB Item deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.deleteRABItem = deleteRABItem;
