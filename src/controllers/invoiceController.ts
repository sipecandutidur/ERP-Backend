import { Request, Response } from 'express';
import prisma from '../prisma';
import { logActivity } from '../utils/auditLogger';

export const getInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const invoices = await (prisma.invoice as any).findMany({
      include: {
        customer: true,
        quotation: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ status: 'success', data: { invoices } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch invoices' });
  }
};

export const getInvoiceById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    const invoice = await (prisma.invoice as any).findUnique({
      where: { id },
      include: {
        items: { include: { item: true } },
        customer: { include: { organization: true } },
        quotation: true,
        payments: true,
      },
    });

    if (!invoice) {
      res.status(404).json({ status: 'error', message: 'Invoice not found' });
      return;
    }

    res.status(200).json({ status: 'success', data: { invoice } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch invoice' });
  }
};

export const createInvoice = async (req: Request | any, res: Response): Promise<void> => {
  const { invoiceNumber, date, dueDate, customerId, quotationId, subtotal, tax, total, items } = req.body;

  if (!invoiceNumber || !customerId || !items || items.length === 0) {
    res.status(400).json({ status: 'error', message: 'invoiceNumber, customerId, and items are required' });
    return;
  }

  try {
    const processedItems = items.map((i: any) => ({
      itemId: i.itemId,
      quantity: Number(i.quantity),
      price: Number(i.price),
      total: Number(i.total),
    }));

    const invoice = await (prisma.invoice as any).create({
      data: {
        invoiceNumber,
        date: date ? new Date(date) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        customerId,
        quotationId,
        subtotal: Number(subtotal) || 0,
        tax: Number(tax) || 0,
        total: Number(total) || 0,
        items: { create: processedItems },
      },
      include: { items: true },
    });

    await logActivity({
      action: 'CREATE',
      entity: 'Invoice',
      entityId: invoice.id,
      details: `Invoice "${invoice.invoiceNumber}" created`,
      userId: req.user?.id,
      userName: req.user?.name,
    });

    res.status(201).json({ status: 'success', data: { invoice } });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ status: 'error', message: 'Invoice number already exists' });
      return;
    }
    console.error("Create invoice error:", error);
    res.status(500).json({ status: 'error', message: 'Failed to create invoice' });
  }
};

export const updateInvoiceStatus = async (req: Request | any, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { status } = req.body;

  try {
    const invoice = await (prisma.invoice as any).update({
      where: { id },
      data: { status },
    });

    await logActivity({
      action: 'UPDATE_STATUS',
      entity: 'Invoice',
      entityId: invoice.id,
      details: `Invoice "${invoice.invoiceNumber}" status updated to ${status}`,
      userId: req.user?.id,
      userName: req.user?.name,
    });

    res.status(200).json({ status: 'success', data: { invoice } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error updating invoice status' });
  }
};

export const deleteInvoice = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    await (prisma.invoice as any).delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error deleting invoice' });
  }
};

export const generateFromQuotation = async (req: Request | any, res: Response): Promise<void> => {
  const { quotationId } = req.params;

  try {
    const quotation = await (prisma.quotation as any).findUnique({
      where: { id: quotationId },
      include: { items: true, customer: true },
    });

    if (!quotation) {
      res.status(404).json({ status: 'error', message: 'Quotation not found' });
      return;
    }

    // Generate invoice number e.g. INV-202403-001
    const currentYearMonth = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const lastInvoice = await (prisma.invoice as any).findFirst({
      where: { invoiceNumber: { startsWith: `INV-${currentYearMonth}-` } },
      orderBy: { invoiceNumber: 'desc' },
    });

    let currentSeq = 0;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split('-');
      if (parts.length === 3) {
        currentSeq = parseInt(parts[2], 10);
        if (isNaN(currentSeq)) currentSeq = 0;
      }
    }
    currentSeq++;
    const invoiceNumber = `INV-${currentYearMonth}-${currentSeq.toString().padStart(4, '0')}`;

    const processedItems = quotation.items.map((i: any) => ({
      itemId: i.itemId,
      quantity: i.quantity,
      price: i.price,
      total: i.total,
    }));

    const invoice = await (prisma.invoice as any).create({
      data: {
        invoiceNumber,
        date: new Date(),
        customerId: quotation.customerId,
        quotationId: quotation.id,
        subtotal: quotation.subtotal,
        tax: quotation.tax,
        total: quotation.total,
        items: {
          create: processedItems
        }
      },
      include: { items: { include: { item: true } }, customer: { include: { organization: true } } }
    });

    await logActivity({
      action: 'GENERATE',
      entity: 'Invoice',
      entityId: invoice.id,
      details: `Invoice "${invoice.invoiceNumber}" generated from Quotation "${quotation.quoteNumber}"`,
      userId: req.user?.id,
      userName: req.user?.name,
    });

    res.status(201).json({ status: 'success', data: { invoice } });
  } catch (error) {
    console.error("Generate invoice error:", error);
    res.status(500).json({ status: 'error', message: 'Failed to generate invoice' });
  }
};

export const addPayment = async (req: Request | any, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { amount, date, method, reference } = req.body;

  try {
    const invoice = await (prisma.invoice as any).findUnique({ where: { id } });
    if (!invoice) {
       res.status(404).json({ status: 'error', message: 'Invoice not found' });
       return;
    }

    // Generate payment number
    const currentYearMonth = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const lastPayment = await (prisma.payment as any).findFirst({
      where: { paymentNumber: { startsWith: `PAY-${currentYearMonth}-` } },
      orderBy: { paymentNumber: 'desc' },
    });

    let currentSeq = 0;
    if (lastPayment) {
      const parts = lastPayment.paymentNumber.split('-');
      if (parts.length === 3) {
        currentSeq = parseInt(parts[2], 10);
      }
    }
    currentSeq++;
    const paymentNumber = `PAY-${currentYearMonth}-${currentSeq.toString().padStart(4, '0')}`;

    const payment = await (prisma.payment as any).create({
      data: {
        paymentNumber,
        invoiceId: id,
        amount: Number(amount),
        date: date ? new Date(date) : new Date(),
        method,
        reference,
        cashFlowTransaction: {
          create: {
            date: date ? new Date(date) : new Date(),
            type: 'INCOME',
            amount: Number(amount),
            description: `Payment for Invoice ${invoice.invoiceNumber}`,
            category: 'Sales',
          }
        }
      }
    });

    // Update invoice amountPaid and status
    const newAmountPaid = invoice.amountPaid + Number(amount);
    let status = 'PARTIAL';
    if (newAmountPaid >= invoice.total) {
      status = 'PAID';
    }

    await (prisma.invoice as any).update({
      where: { id },
      data: {
        amountPaid: newAmountPaid,
        status,
      }
    });

    await logActivity({
      action: 'PAYMENT',
      entity: 'Invoice',
      entityId: id,
      details: `Payment of ${amount} received for Invoice "${invoice.invoiceNumber}"`,
      userId: req.user?.id,
      userName: req.user?.name,
    });

    res.status(201).json({ status: 'success', data: { payment } });
  } catch (error) {
    console.error("Add payment error:", error);
    res.status(500).json({ status: 'error', message: 'Failed to record payment' });
  }
};
