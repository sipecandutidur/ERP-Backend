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
exports.deleteOrganization = exports.updateOrganization = exports.createOrganization = exports.getOrganizationById = exports.getOrganizations = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const getOrganizations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const organizations = yield prisma_1.default.organization.findMany({
        orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: 'success', data: { organizations } });
});
exports.getOrganizations = getOrganizations;
const getOrganizationById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const organization = yield prisma_1.default.organization.findUnique({
        where: { id },
    });
    if (!organization) {
        res.status(404).json({ status: 'error', message: 'Organization not found' });
        return;
    }
    res.status(200).json({ status: 'success', data: { organization } });
});
exports.getOrganizationById = getOrganizationById;
const createOrganization = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, address, phone, email, website, npwp } = req.body;
    if (!name) {
        res.status(400).json({ status: 'error', message: 'Name is required' });
        return;
    }
    // Check for existing organization to prevent duplicates
    const existingOrganization = yield prisma_1.default.organization.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } }
    });
    if (existingOrganization) {
        res.status(400).json({ status: 'error', message: 'Organization with this name already exists' });
        return;
    }
    // Auto-generate code e.g. ORG-0001
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
    const organization = yield prisma_1.default.organization.create({
        data: {
            code,
            name,
            address,
            phone,
            email,
            website,
            npwp,
        },
    });
    res.status(201).json({ status: 'success', data: { organization } });
});
exports.createOrganization = createOrganization;
const updateOrganization = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, address, phone, email, website, npwp } = req.body;
    const dataToUpdate = {};
    if (name)
        dataToUpdate.name = name;
    if (address !== undefined)
        dataToUpdate.address = address;
    if (phone !== undefined)
        dataToUpdate.phone = phone;
    if (email !== undefined)
        dataToUpdate.email = email;
    if (website !== undefined)
        dataToUpdate.website = website;
    if (npwp !== undefined)
        dataToUpdate.npwp = npwp;
    try {
        const organization = yield prisma_1.default.organization.update({
            where: { id },
            data: dataToUpdate,
        });
        res.status(200).json({ status: 'success', data: { organization } });
    }
    catch (error) {
        res.status(400).json({ status: 'error', message: 'Error updating organization' });
    }
});
exports.updateOrganization = updateOrganization;
const deleteOrganization = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield prisma_1.default.organization.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        res.status(400).json({ status: 'error', message: 'Error deleting organization (ensure no associated customers exist)' });
    }
});
exports.deleteOrganization = deleteOrganization;
