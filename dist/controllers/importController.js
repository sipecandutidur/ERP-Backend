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
exports.importItemsExcel = exports.importOrganizations = exports.importDistributors = exports.importCustomers = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const importCustomers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { data } = req.body; // Array of objects from CSV parsed by frontend
        if (!Array.isArray(data) || data.length === 0) {
            res.status(400).json({ status: 'error', message: 'No data provided for import' });
            return;
        }
        let createdCount = 0;
        let skippedCount = 0;
        for (const row of data) {
            if (!row.name)
                continue; // Skip if no name
            // Check if customer with same name already exists
            const existingCustomer = yield prisma_1.default.customer.findFirst({
                where: { name: { equals: String(row.name), mode: 'insensitive' } }
            });
            if (existingCustomer) {
                skippedCount++;
                continue;
            }
            let organizationId = null;
            // Look up or create organization if organization name is provided
            if (row.organizationName) {
                let org = yield prisma_1.default.organization.findFirst({
                    where: { name: { equals: row.organizationName, mode: 'insensitive' } }
                });
                if (!org) {
                    // generate org code
                    const orgCount = yield prisma_1.default.organization.count();
                    const orgCode = `ORG-${(orgCount + 1).toString().padStart(4, '0')}`;
                    org = yield prisma_1.default.organization.create({
                        data: {
                            code: orgCode,
                            name: row.organizationName,
                            phone: row.phone ? String(row.phone) : null,
                            email: row.email ? String(row.email) : null,
                            address: row.address ? String(row.address) : null,
                        }
                    });
                }
                organizationId = org.id;
            }
            // Auto-generate Customer code
            const count = yield prisma_1.default.customer.count();
            const code = row.code || `CUST-${(count + 1).toString().padStart(4, '0')}`;
            yield prisma_1.default.customer.create({
                data: {
                    code,
                    name: row.name,
                    email: row.email ? String(row.email) : null,
                    phone: row.phone ? String(row.phone) : null,
                    address: row.address ? String(row.address) : null,
                    npwp: row.npwp ? String(row.npwp) : null,
                    organizationId
                }
            });
            createdCount++;
        }
        const message = skippedCount > 0
            ? `Successfully imported ${createdCount} customers. Skipped ${skippedCount} duplicate(s).`
            : `Successfully imported ${createdCount} customers.`;
        res.status(200).json({ status: 'success', message });
    }
    catch (error) {
        console.error('Import Customers Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to import customers. Check server logs.' });
    }
});
exports.importCustomers = importCustomers;
const importDistributors = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { data } = req.body;
        if (!Array.isArray(data) || data.length === 0) {
            res.status(400).json({ status: 'error', message: 'No data provided for import' });
            return;
        }
        let createdCount = 0;
        let skippedCount = 0;
        for (const row of data) {
            if (!row.name)
                continue; // Skip if no name
            // Check if distributor with same name already exists
            const existingDistributor = yield prisma_1.default.distributor.findFirst({
                where: { name: { equals: String(row.name), mode: 'insensitive' } }
            });
            if (existingDistributor) {
                skippedCount++;
                continue;
            }
            // Auto-generate Distributor code
            const count = yield prisma_1.default.distributor.count();
            const code = row.code || `DIST-${(count + 1).toString().padStart(4, '0')}`;
            yield prisma_1.default.distributor.create({
                data: {
                    code,
                    name: row.name,
                    email: row.email ? String(row.email) : null,
                    phone: row.phone ? String(row.phone) : null,
                    address: row.address ? String(row.address) : null,
                    website: row.website ? String(row.website) : null,
                    district: row.district ? String(row.district) : null,
                    npwp: row.npwp ? String(row.npwp) : null,
                    bankName: row.bankName ? String(row.bankName) : null,
                    bankAccountName: row.bankAccountName ? String(row.bankAccountName) : null,
                    bankAccountNumber: row.bankAccountNumber ? String(row.bankAccountNumber) : null,
                }
            });
            createdCount++;
        }
        const message = skippedCount > 0
            ? `Successfully imported ${createdCount} distributors. Skipped ${skippedCount} duplicate(s).`
            : `Successfully imported ${createdCount} distributors.`;
        res.status(200).json({ status: 'success', message });
    }
    catch (error) {
        console.error('Import Distributors Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to import distributors. Check server logs.' });
    }
});
exports.importDistributors = importDistributors;
const importOrganizations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { data } = req.body;
        if (!Array.isArray(data) || data.length === 0) {
            res.status(400).json({ status: 'error', message: 'No data provided for import' });
            return;
        }
        let createdCount = 0;
        let skippedCount = 0;
        for (const row of data) {
            if (!row.name)
                continue; // Skip if no name
            // Check if organization with same name already exists
            const existingOrganization = yield prisma_1.default.organization.findFirst({
                where: { name: { equals: String(row.name), mode: 'insensitive' } }
            });
            if (existingOrganization) {
                skippedCount++;
                continue;
            }
            // Auto-generate Organization code
            const lastOrg = yield prisma_1.default.organization.findFirst({
                orderBy: { createdAt: 'desc' },
            });
            let code = 'ORG-0001';
            if (lastOrg && lastOrg.code.startsWith('ORG-')) {
                const lastNumber = parseInt(lastOrg.code.replace('ORG-', ''), 10);
                if (!isNaN(lastNumber)) {
                    code = `ORG-${(lastNumber + 1).toString().padStart(4, '0')}`;
                }
            }
            else if (lastOrg) {
                const count = yield prisma_1.default.organization.count();
                code = `ORG-${(count + 1).toString().padStart(4, '0')}`;
            }
            yield prisma_1.default.organization.create({
                data: {
                    code: row.code || code,
                    name: typeof row.name === 'string' ? row.name : String(row.name),
                    email: row.email ? String(row.email) : null,
                    phone: row.phone ? String(row.phone) : null,
                    address: row.address ? String(row.address) : null,
                    website: row.website ? String(row.website) : null,
                    npwp: row.npwp ? String(row.npwp) : null,
                }
            });
            createdCount++;
        }
        const message = skippedCount > 0
            ? `Successfully imported ${createdCount} organizations. Skipped ${skippedCount} duplicate(s).`
            : `Successfully imported ${createdCount} organizations.`;
        res.status(200).json({ status: 'success', message });
    }
    catch (error) {
        console.error('Import Organizations Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to import organizations. Check server logs.' });
    }
});
exports.importOrganizations = importOrganizations;
const importItemsExcel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { data } = req.body;
        if (!Array.isArray(data) || data.length === 0) {
            res.status(400).json({ status: 'error', message: 'No data provided for import' });
            return;
        }
        // Group the incoming Excel data by Catalog Code or Product Name
        // This allows multiple rows with the same item to aggregate their distributors
        const itemsMap = new Map();
        for (const row of data) {
            const rowCode = row['Catalogs'] || row['code'] || '';
            const rowName = row['Nama Product'] || row['name'] || row['product'] || row['Product'];
            if (!rowName)
                continue; // Skip if no name
            const groupKey = rowCode || rowName;
            if (!itemsMap.has(groupKey)) {
                itemsMap.set(groupKey, {
                    code: rowCode,
                    name: String(rowName),
                    description: row['Spesifikasi'] || row['description'] || '',
                    category: row['Category'] || row['category'] || 'General',
                    unit: row['Unit'] || row['unit'] || 'Pcs',
                    stock: Number(row['Stock'] || row['stock']) || 0,
                    distributors: []
                });
            }
            const distName = row['Distributor'] || row['distributor'] || row['dist'];
            if (distName) {
                itemsMap.get(groupKey).distributors.push({
                    name: String(distName),
                    basePrice: Number(row['Base Price'] || row['basePrice']) || 0,
                    discount: Number(row['Disc(%)'] || row['discount'] || row['Disc']) || 0,
                    tax: Number(row['Tax(%)'] || row['tax'] || row['Tax']) || 0,
                    margin: Number(row['Marg(%)'] || row['margin'] || row['Margin']) || 0,
                    sellPrice: Number(row['Sell Price'] || row['sellPrice']) || 0,
                });
            }
        }
        const payload = Array.from(itemsMap.values());
        let createdCount = 0;
        let skippedCount = 0;
        for (const itemData of payload) {
            // Check if item already exists in DB to prevent exact name duplicates
            const existingItem = yield prisma_1.default.item.findFirst({
                where: { name: { equals: itemData.name, mode: 'insensitive' } }
            });
            if (existingItem) {
                skippedCount++;
                continue;
            }
            const count = yield prisma_1.default.item.count();
            const code = itemData.code || `ITEM-${(count + 1).toString().padStart(4, '0')}`;
            // Resolve distributor IDs from names and link them
            const itemDistributorsData = [];
            for (const d of itemData.distributors) {
                const dist = yield prisma_1.default.distributor.findFirst({
                    where: { name: { equals: d.name, mode: 'insensitive' } }
                });
                if (dist) {
                    itemDistributorsData.push({
                        distributorId: dist.id,
                        basePrice: d.basePrice,
                        discount: d.discount,
                        tax: d.tax,
                        margin: d.margin,
                        sellPrice: d.sellPrice,
                    });
                }
            }
            yield prisma_1.default.item.create({
                data: {
                    code,
                    name: itemData.name,
                    description: itemData.description,
                    category: itemData.category,
                    unit: itemData.unit,
                    stock: itemData.stock,
                    itemDistributors: { create: itemDistributorsData }
                }
            });
            createdCount++;
        }
        const message = skippedCount > 0
            ? `Successfully imported ${createdCount} items. Skipped ${skippedCount} duplicate(s).`
            : `Successfully imported ${createdCount} items.`;
        res.status(200).json({ status: 'success', message });
    }
    catch (error) {
        console.error('Import Items Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to import items. Check server logs.' });
    }
});
exports.importItemsExcel = importItemsExcel;
