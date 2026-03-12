import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import 'express-async-errors';
import path from 'path';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import customerRoutes from './routes/customerRoutes';
import distributorRoutes from './routes/distributorRoutes';
import itemRoutes from './routes/itemRoutes';
import quotationRoutes from './routes/quotationRoutes';
import vendorQuotationRoutes from './routes/vendorQuotationRoutes';
import deliveryNoteRoutes from './routes/deliveryNoteRoutes';
import invoiceRoutes from './routes/invoiceRoutes';
import accountingRoutes from './routes/accountingRoutes';
import organizationRoutes from './routes/organizationRoutes';
import projectRoutes from './routes/projectRoutes';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes';

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/distributors', distributorRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/vendor-quotations', vendorQuotationRoutes);
app.use('/api/delivery-notes', deliveryNoteRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'success', message: 'Backend is running' });
});

// 404 Handler
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    status: 'error',
    message: 'Resource not found',
  });
});

// Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
  });
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
