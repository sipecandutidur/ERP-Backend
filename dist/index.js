"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
require("express-async-errors");
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
// Middlewares
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serve static files from the uploads directory
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const customerRoutes_1 = __importDefault(require("./routes/customerRoutes"));
const distributorRoutes_1 = __importDefault(require("./routes/distributorRoutes"));
const itemRoutes_1 = __importDefault(require("./routes/itemRoutes"));
const quotationRoutes_1 = __importDefault(require("./routes/quotationRoutes"));
const vendorQuotationRoutes_1 = __importDefault(require("./routes/vendorQuotationRoutes"));
const deliveryNoteRoutes_1 = __importDefault(require("./routes/deliveryNoteRoutes"));
const invoiceRoutes_1 = __importDefault(require("./routes/invoiceRoutes"));
const accountingRoutes_1 = __importDefault(require("./routes/accountingRoutes"));
const organizationRoutes_1 = __importDefault(require("./routes/organizationRoutes"));
const projectRoutes_1 = __importDefault(require("./routes/projectRoutes"));
const purchaseOrderRoutes_1 = __importDefault(require("./routes/purchaseOrderRoutes"));
// Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
app.use('/api/customers', customerRoutes_1.default);
app.use('/api/distributors', distributorRoutes_1.default);
app.use('/api/items', itemRoutes_1.default);
app.use('/api/quotations', quotationRoutes_1.default);
app.use('/api/vendor-quotations', vendorQuotationRoutes_1.default);
app.use('/api/delivery-notes', deliveryNoteRoutes_1.default);
app.use('/api/invoices', invoiceRoutes_1.default);
app.use('/api/accounting', accountingRoutes_1.default);
app.use('/api/organizations', organizationRoutes_1.default);
app.use('/api/projects', projectRoutes_1.default);
app.use('/api/purchase-orders', purchaseOrderRoutes_1.default);
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Backend is running' });
});
// 404 Handler
app.use((req, res, next) => {
    res.status(404).json({
        status: 'error',
        message: 'Resource not found',
    });
});
// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
    });
});
app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});
