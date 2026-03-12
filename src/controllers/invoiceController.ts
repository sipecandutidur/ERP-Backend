import { Request, Response } from 'express';
import prisma from '../prisma';
import { bankersRound } from '../utils/math';

export const getInvoices = async (req: Request, res: Response): Promise<void> => {
  const invoices = await prisma.invoice.findMany({
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json({ status: 'success', data: { invoices } });
};

export const getInvoiceById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: { include: { organization: true } },
      quotation: { include: { project: true } },
      items: { include: { item: true } },
      payments: true,
    },
  });

  if (!invoice) {
    res.status(404).json({ status: 'error', message: 'Invoice not found' });
    return;
  }

  res.status(200).json({ status: 'success', data: { invoice } });
};

export const createInvoice = async (req: Request, res: Response): Promise<void> => {
  const { invoiceNumber, customerId, quotationId, dueDate, items, tax } = req.body;

  if (!invoiceNumber || !customerId || !items || items.length === 0) {
    res.status(400).json({ status: 'error', message: 'Missing required fields' });
    return;
  }

  const existingInvoice = await prisma.invoice.findUnique({ where: { invoiceNumber } });
  if (existingInvoice) {
    res.status(400).json({ status: 'error', message: 'Invoice number already exists' });
    return;
  }

  let subtotal = 0;
  const processedItems = items.map((i: any) => {
    const total = i.quantity * i.price;
    subtotal += total;
    return {
      itemId: i.itemId,
      quantity: i.quantity,
      price: i.price,
      total,
    };
  });

  const finalTax = tax || 0;
  const total = subtotal + finalTax;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      customerId,
      quotationId,
      dueDate: dueDate ? new Date(dueDate) : null,
      subtotal,
      tax: finalTax,
      total,
      amountPaid: 0,
      items: { create: processedItems },
    },
    include: { items: true },
  });

  res.status(201).json({ status: 'success', data: { invoice } });
};

export const addPayment = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string }; // invoice ID
  const { paymentNumber, amount, method, reference, date } = req.body;

  if (!paymentNumber || !amount || !method) {
    res.status(400).json({ status: 'error', message: 'Missing payment fields' });
    return;
  }

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        quotation: {
          include: {
            project: true
          }
        }
      }
    });
    if (!invoice) {
      res.status(404).json({ status: 'error', message: 'Invoice not found' });
      return;
    }

    const paymentDate = date ? new Date(date) : new Date();
    const projectName = invoice.quotation?.project?.name || 'Unknown Project';

    const result = await prisma.$transaction(async (tx: any) => {
      // Create payment
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          amount,
          method,
          reference,
          date: paymentDate,
          invoiceId: id,
          cashFlow: {
            create: {
              date: paymentDate,
              type: 'INCOME',
              amount,
              description: `Invoice ${invoice.invoiceNumber} - ${projectName}`,
              category: '4101 - Pendapatan Penjualan Produk',
            }
          }
        },
      });

      // Update invoice amountPaid and status
      const newAmountPaid = invoice.amountPaid + amount;
      const status = newAmountPaid >= invoice.total ? 'PAID' : 'PARTIAL';

      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: { amountPaid: newAmountPaid, status },
      });

      return { payment, invoice: updatedInvoice };
    });

    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error adding payment' });
  }
};

export const generateFromQuotation = async (req: Request | any, res: Response): Promise<void> => {
  const { quotationId } = req.params;
  const { itemIds }: { itemIds?: string[] } = req.body || {};

  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { items: true }
    });

    if (!quotation) {
      res.status(404).json({ status: 'error', message: 'Quotation not found' });
      return;
    }

    if (!quotation.items || quotation.items.length === 0) {
      res.status(400).json({ status: 'error', message: 'Quotation has no items' });
      return;
    }

    // Filter items if specific IDs were provided
    const sourceItems = (itemIds && itemIds.length > 0)
      ? quotation.items.filter((i: any) => itemIds.includes(i.id))
      : quotation.items;

    // Generate Invoice Number INV-YYYYMM-XXXX
    const currentYearMonth = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const lastInvoice = await prisma.invoice.findFirst({
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
    const invoiceNumber: string = `INV-${currentYearMonth}-${currentSeq.toString().padStart(4, '0')}`;

    const processedItems = sourceItems.map((i: any) => ({
      itemId: i.itemId,
      quantity: i.quantity,
      price: i.price,
      total: i.quantity * i.price,
    }));

    // Recalculate totals from selected items
    const subtotal = processedItems.reduce((s: number, i: any) => s + (i.total || 0), 0);
    const taxRate = quotation.subtotal > 0 ? (quotation.tax / quotation.subtotal) : 0;
    const tax = bankersRound(subtotal * taxRate);
    const total = subtotal + tax;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId: quotation.customerId,
        quotationId: quotation.id,
        status: "UNPAID",
        subtotal,
        tax,
        total,
        amountPaid: 0,
        items: {
          create: processedItems
        }
      },
      include: { items: { include: { item: true } }, customer: { include: { organization: true } } }
    });

    res.status(201).json({ status: 'success', data: { invoice } });
  } catch (error: any) {
    console.error("Generate invoice error:", error);
    res.status(500).json({ status: 'error', message: 'Failed to generate invoice' });
  }
};
