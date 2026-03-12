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
exports.updateProjectStage = exports.getPipelineProjects = exports.deleteProjectDocument = exports.uploadProjectDocument = exports.getProjectDocuments = exports.deleteProject = exports.updateProject = exports.createProject = exports.getProjectById = exports.getProjects = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const getProjects = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projects = yield prisma_1.default.project.findMany({
            include: {
                customer: {
                    include: {
                        organization: true,
                    }
                },
                rab: true
            },
            orderBy: { createdAt: 'desc' }
        });
        const mappedProjects = projects.map(project => {
            var _a;
            return (Object.assign(Object.assign({}, project), { initialCapital: ((_a = project.rab) === null || _a === void 0 ? void 0 : _a.totalEstimatedCost) || project.initialCapital }));
        });
        res.status(200).json({ status: 'success', data: { projects: mappedProjects } });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
exports.getProjects = getProjects;
const getProjectById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    try {
        const project = yield prisma_1.default.project.findUnique({
            where: { id },
            include: {
                customer: {
                    include: {
                        organization: true,
                    }
                },
                rab: true // include to get totalEstimatedCost for Initial Capital
            },
        });
        if (!project) {
            res.status(404).json({ status: 'error', message: 'Project not found' });
            return;
        }
        // Map initialCapital to be the RAB's totalEstimatedCost if available
        const projectResponse = Object.assign(Object.assign({}, project), { initialCapital: ((_a = project.rab) === null || _a === void 0 ? void 0 : _a.totalEstimatedCost) || project.initialCapital });
        res.status(200).json({ status: 'success', data: { project: projectResponse } });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
exports.getProjectById = getProjectById;
const createProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { spkNumber, name, status, customerId, value, initialCapital } = req.body;
    if (!spkNumber || !name || !customerId) {
        res.status(400).json({ status: 'error', message: 'SPK Number, Name, and Customer are required' });
        return;
    }
    try {
        // Generate Project Code: PRJ-YYMM-XXXX
        const count = yield prisma_1.default.project.count();
        const projectCode = `PRJ-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(count + 1).toString().padStart(4, '0')}`;
        const project = yield prisma_1.default.project.create({
            data: {
                code: projectCode,
                spkNumber,
                name,
                status: status || 'PENDING',
                customerId,
                value: Number(value) || 0,
                initialCapital: Number(initialCapital) || 0,
            },
            include: {
                customer: {
                    include: {
                        organization: true,
                    }
                }
            }
        });
        res.status(201).json({ status: 'success', data: { project } });
    }
    catch (error) {
        if (error.code === 'P2002') {
            res.status(400).json({ status: 'error', message: 'SPK Number already exists' });
        }
        else {
            res.status(500).json({ status: 'error', message: error.message });
        }
    }
});
exports.createProject = createProject;
const updateProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { spkNumber, name, status, customerId, value, initialCapital } = req.body;
    try {
        const project = yield prisma_1.default.project.update({
            where: { id },
            data: {
                spkNumber,
                name,
                status: status,
                customerId,
                value: value !== undefined ? Number(value) : undefined,
                initialCapital: initialCapital !== undefined ? Number(initialCapital) : undefined,
            },
            include: {
                customer: {
                    include: {
                        organization: true,
                    }
                }
            }
        });
        res.status(200).json({ status: 'success', data: { project } });
    }
    catch (error) {
        if (error.code === 'P2002') {
            res.status(400).json({ status: 'error', message: 'SPK Number already exists' });
        }
        else {
            res.status(500).json({ status: 'error', message: error.message });
        }
    }
});
exports.updateProject = updateProject;
const deleteProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield prisma_1.default.project.delete({
            where: { id },
        });
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
exports.deleteProject = deleteProject;
const getProjectDocuments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const project = yield prisma_1.default.project.findUnique({
            where: { id },
            include: {
                quotations: true,
                documents: true, // Fetch manual documents
            }
        });
        if (!project) {
            res.status(404).json({ status: 'error', message: 'Project not found' });
            return;
        }
        const projectCode = project.code;
        // Vendor Quotations linked by projectCode
        const vendorQuotations = projectCode ? yield prisma_1.default.vendorQuotation.findMany({
            where: { projectCode }
        }) : [];
        // Purchase Orders linked by projectCode
        const purchaseOrders = projectCode ? yield prisma_1.default.purchaseOrder.findMany({
            where: { projectCode }
        }) : [];
        // Delivery Notes linked by Quotation.projectId
        const deliveryNotes = yield prisma_1.default.deliveryNote.findMany({
            where: {
                quotation: {
                    projectId: id
                }
            }
        });
        // Invoices linked by Quotation.projectId or CustomerId
        const invoices = yield prisma_1.default.invoice.findMany({
            where: {
                OR: [
                    { quotation: { projectId: id } },
                    // Note: In a real system, we'd need a firmer way to link invoice to project if not via quotation
                ]
            }
        });
        res.status(200).json({
            status: 'success',
            data: {
                quotations: project.quotations,
                vendorQuotations,
                purchaseOrders,
                deliveryNotes,
                invoices,
                manualDocuments: project.documents,
            }
        });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
exports.getProjectDocuments = getProjectDocuments;
const uploadProjectDocument = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, type } = req.body;
    if (!req.file) {
        res.status(400).json({ status: 'error', message: 'No file uploaded' });
        return;
    }
    try {
        const fileUrl = `/uploads/projects/${req.file.filename}`;
        const document = yield prisma_1.default.projectDocument.create({
            data: {
                projectId: id,
                name: name || req.file.originalname,
                fileUrl,
                type: type || req.file.mimetype,
            }
        });
        res.status(201).json({ status: 'success', data: { document } });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
exports.uploadProjectDocument = uploadProjectDocument;
const deleteProjectDocument = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { docId } = req.params;
    try {
        yield prisma_1.default.projectDocument.delete({
            where: { id: docId }
        });
        // In a production environment, you would also use fs.unlink to delete the actual file
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
exports.deleteProjectDocument = deleteProjectDocument;
// ==========================================
// PIPELINE (KANBAN)
// ==========================================
const PIPELINE_STAGES = ['BARU', 'BERKUALIFIKASI', 'PROPOSISI', 'BERHASIL', 'REJECT'];
const getPipelineProjects = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projects = yield prisma_1.default.project.findMany({
            include: {
                customer: {
                    include: { organization: true },
                },
            },
            orderBy: [
                { pipelineStage: 'asc' },
                { stageOrder: 'asc' },
                { createdAt: 'asc' },
            ],
        });
        // Group projects by pipeline stage
        const pipeline = {
            BARU: [],
            BERKUALIFIKASI: [],
            PROPOSISI: [],
            BERHASIL: [],
            REJECT: [],
        };
        for (const project of projects) {
            pipeline[project.pipelineStage].push(project);
        }
        res.status(200).json({ status: 'success', data: { pipeline, stages: PIPELINE_STAGES } });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
exports.getPipelineProjects = getPipelineProjects;
const updateProjectStage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { pipelineStage, stageOrder } = req.body;
    if (!pipelineStage || !PIPELINE_STAGES.includes(pipelineStage)) {
        res.status(400).json({ status: 'error', message: 'Invalid pipeline stage' });
        return;
    }
    try {
        const project = yield prisma_1.default.project.update({
            where: { id },
            data: {
                pipelineStage: pipelineStage,
                stageOrder: stageOrder !== undefined ? Number(stageOrder) : undefined,
            },
            include: {
                customer: { include: { organization: true } },
            },
        });
        res.status(200).json({ status: 'success', data: { project } });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
exports.updateProjectStage = updateProjectStage;
