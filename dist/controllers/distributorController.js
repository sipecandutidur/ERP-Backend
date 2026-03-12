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
exports.deleteDistributor = exports.updateDistributor = exports.createDistributor = exports.getDistributorById = exports.getDistributors = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const getDistributors = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const distributors = yield prisma_1.default.distributor.findMany({
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: 'success', data: { distributors } });
});
exports.getDistributors = getDistributors;
const getDistributorById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const distributor = yield prisma_1.default.distributor.findUnique({
        where: { id },
    });
    if (!distributor) {
        res.status(404).json({ status: 'error', message: 'Distributor not found' });
        return;
    }
    res.status(200).json({ status: 'success', data: { distributor } });
});
exports.getDistributorById = getDistributorById;
const createDistributor = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, address, district, phone, email, website, npwp, bankName, bankAccountName, bankAccountNumber } = req.body;
    if (!name) {
        res.status(400).json({ status: 'error', message: 'Name is required' });
        return;
    }
    // Check for existing distributor to prevent duplicates
    const existingDistributor = yield prisma_1.default.distributor.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } }
    });
    if (existingDistributor) {
        res.status(400).json({ status: 'error', message: 'Distributor with this name already exists' });
        return;
    }
    // Auto-generate code e.g. DIST-0001
    const lastDistributor = yield prisma_1.default.distributor.findFirst({
        orderBy: { id: 'desc' }, // Assuming id is UUID, it might not sort perfectly by creation time, but no createdAt field exists
    });
    // Actually, we don't have createdAt on distributor according to the snippet, or maybe we do? Let's use count.
    const count = yield prisma_1.default.distributor.count();
    const code = `DIST-${(count + 1).toString().padStart(4, '0')}`;
    const distributor = yield prisma_1.default.distributor.create({
        data: { code, name, address, district, phone, email, website, npwp, bankName, bankAccountName, bankAccountNumber },
    });
    res.status(201).json({ status: 'success', data: { distributor } });
});
exports.createDistributor = createDistributor;
const updateDistributor = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, address, district, phone, email, website, npwp, bankName, bankAccountName, bankAccountNumber } = req.body;
    const dataToUpdate = {};
    if (name)
        dataToUpdate.name = name;
    if (address !== undefined)
        dataToUpdate.address = address;
    if (district !== undefined)
        dataToUpdate.district = district;
    if (phone !== undefined)
        dataToUpdate.phone = phone;
    if (email !== undefined)
        dataToUpdate.email = email;
    if (website !== undefined)
        dataToUpdate.website = website;
    if (npwp !== undefined)
        dataToUpdate.npwp = npwp;
    if (bankName !== undefined)
        dataToUpdate.bankName = bankName;
    if (bankAccountName !== undefined)
        dataToUpdate.bankAccountName = bankAccountName;
    if (bankAccountNumber !== undefined)
        dataToUpdate.bankAccountNumber = bankAccountNumber;
    try {
        const distributor = yield prisma_1.default.distributor.update({
            where: { id },
            data: dataToUpdate,
        });
        res.status(200).json({ status: 'success', data: { distributor } });
    }
    catch (error) {
        res.status(400).json({ status: 'error', message: 'Error updating distributor' });
    }
});
exports.updateDistributor = updateDistributor;
const deleteDistributor = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield prisma_1.default.distributor.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        res.status(400).json({ status: 'error', message: 'Error deleting distributor or related records exist' });
    }
});
exports.deleteDistributor = deleteDistributor;
