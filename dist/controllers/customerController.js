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
exports.deleteCustomer = exports.updateCustomer = exports.createCustomer = exports.getCustomerById = exports.getCustomers = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const getCustomers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const customers = yield prisma_1.default.customer.findMany({
        include: { contacts: true, organization: true },
        orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ status: 'success', data: { customers } });
});
exports.getCustomers = getCustomers;
const getCustomerById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const customer = yield prisma_1.default.customer.findUnique({
        where: { id },
        include: { contacts: true, organization: true },
    });
    if (!customer) {
        res.status(404).json({ status: 'error', message: 'Customer not found' });
        return;
    }
    res.status(200).json({ status: 'success', data: { customer } });
});
exports.getCustomerById = getCustomerById;
const createCustomer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, address, district, phone, email, npwp, organizationId, contacts } = req.body;
    if (!name) {
        res.status(400).json({ status: 'error', message: 'Name is required' });
        return;
    }
    // Check for existing customer to prevent duplicates
    const existingCustomer = yield prisma_1.default.customer.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } }
    });
    if (existingCustomer) {
        res.status(400).json({ status: 'error', message: 'Customer with this name already exists' });
        return;
    }
    // Auto-generate code e.g. CUST-0001
    const lastCustomer = yield prisma_1.default.customer.findFirst({
        orderBy: { createdAt: 'desc' },
    });
    let code = 'CUST-0001';
    if (lastCustomer && lastCustomer.code.startsWith('CUST-')) {
        const lastNumber = parseInt(lastCustomer.code.replace('CUST-', ''), 10);
        if (!isNaN(lastNumber)) {
            code = `CUST-${(lastNumber + 1).toString().padStart(4, '0')}`;
        }
    }
    else if (lastCustomer) {
        // If last customer doesn't have CUST- prefix, fallback to count
        const count = yield prisma_1.default.customer.count();
        code = `CUST-${(count + 1).toString().padStart(4, '0')}`;
    }
    const customer = yield prisma_1.default.customer.create({
        data: {
            code,
            name,
            address,
            district,
            phone,
            email,
            npwp,
            organizationId,
            contacts: {
                create: contacts || [],
            },
        },
        include: { contacts: true, organization: true },
    });
    res.status(201).json({ status: 'success', data: { customer } });
});
exports.createCustomer = createCustomer;
const updateCustomer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, address, district, phone, email, npwp, organizationId } = req.body;
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
    if (npwp !== undefined)
        dataToUpdate.npwp = npwp;
    if (organizationId !== undefined)
        dataToUpdate.organizationId = organizationId;
    try {
        const customer = yield prisma_1.default.customer.update({
            where: { id },
            data: dataToUpdate,
            include: { contacts: true, organization: true },
        });
        res.status(200).json({ status: 'success', data: { customer } });
    }
    catch (error) {
        res.status(400).json({ status: 'error', message: 'Error updating customer' });
    }
});
exports.updateCustomer = updateCustomer;
const deleteCustomer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        // Delete related contacts first
        yield prisma_1.default.contactPerson.deleteMany({ where: { customerId: id } });
        yield prisma_1.default.customer.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        res.status(400).json({ status: 'error', message: 'Error deleting customer or related records exist' });
    }
});
exports.deleteCustomer = deleteCustomer;
