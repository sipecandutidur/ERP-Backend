import { Request, Response } from 'express';
import prisma from '../prisma';
import { bankersRound } from '../utils/math';

export const getQuotations = async (req: Request, res: Response): Promise<void> => {
  const quotations = await prisma.quotation.findMany({
    include: {
      customer: true,
      project: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ status: 'success', data: { quotations } });
};

export const getQuotationById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: { include: { organization: true } },
      project: { include: { customer: { include: { organization: true } } } },
      user: { select: { id: true, name: true } },
      items: {
        include: {
          item: {
            include: { itemDistributors: true }
          },
          distributor: true
        }
      }
    },
  });

  if (!quotation) {
    res.status(404).json({ status: 'error', message: 'Quotation not found' });
    return;
  }

  res.status(200).json({ status: 'success', data: { quotation } });
};

export const createQuotation = async (req: Request | any, res: Response): Promise<void> => {
  const { customerId, projectId, items, discount, tax, date, validUntil } = req.body;
  const userId = req.user?.id;

  if (!customerId || !items || items.length === 0) {
    res.status(400).json({ status: 'error', message: 'Missing required fields' });
    return;
  }

  const count = await prisma.quotation.count();
  const quoteNumber = `QUO-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(count + 1).toString().padStart(4, '0')}`;

  // Calculate totals
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  const processedItems = items.map((i: any) => {
    // Frontend sends 'unitPrice', but schema holds 'price'
    const actualPrice = i.unitPrice ?? i.price ?? 0;
    const itemDiscount = i.discount || 0;
    const itemTax = i.tax || 0;

    const rowSubtotal = i.quantity * actualPrice;
    const rowDiscAmount = bankersRound(rowSubtotal * (itemDiscount / 100));
    const rowAfterDisc = rowSubtotal - rowDiscAmount;
    const rowTaxAmount = bankersRound(rowAfterDisc * (itemTax / 100));
    const rowFinalTotal = rowAfterDisc; // Tax is collected globally, not inside row total

    subtotal += rowSubtotal;
    totalDiscount += rowDiscAmount;
    totalTax += rowTaxAmount;

    return {
      itemId: i.itemId,
      distributorId: i.distributorId || null,
      quantity: i.quantity,
      price: actualPrice,
      availability: i.availability || null,
      tax: itemTax,
      total: rowFinalTotal,
    };
  });

  const total = subtotal - totalDiscount + totalTax;

  const quotation = await prisma.quotation.create({
    data: {
      quoteNumber,
      customerId,
      projectId,
      userId,
      date: date ? new Date(date) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      subtotal,
      discount: totalDiscount,
      tax: totalTax,
      total,
      items: {
        create: processedItems
      }
    },
    include: { items: true },
  });

  res.status(201).json({ status: 'success', data: { quotation } });
};

export const updateQuotation = async (req: Request | any, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { customerId, projectId, items, discount, tax, date, validUntil } = req.body;

  if (!customerId || !items || items.length === 0) {
    res.status(400).json({ status: 'error', message: 'Missing required fields' });
    return;
  }

  // Calculate totals
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  const processedItems = items.map((i: any) => {
    // Frontend sends 'unitPrice', but schema holds 'price'
    const actualPrice = i.unitPrice ?? i.price ?? 0;
    const itemDiscount = i.discount || 0;
    const itemTax = i.tax || 0;

    const rowSubtotal = i.quantity * actualPrice;
    const rowDiscAmount = bankersRound(rowSubtotal * (itemDiscount / 100));
    const rowAfterDisc = rowSubtotal - rowDiscAmount;
    const rowTaxAmount = bankersRound(rowAfterDisc * (itemTax / 100));
    const rowFinalTotal = rowAfterDisc; // Tax is collected globally, not inside row total

    subtotal += rowSubtotal;
    totalDiscount += rowDiscAmount;
    totalTax += rowTaxAmount;

    return {
      itemId: i.itemId,
      distributorId: i.distributorId || null,
      quantity: i.quantity,
      price: actualPrice,
      availability: i.availability || null,
      tax: itemTax,
      total: rowFinalTotal,
    };
  });

  const total = subtotal - totalDiscount + totalTax;

  try {
    const quotation = await prisma.quotation.update({
      where: { id },
      data: {
        customerId,
        projectId,
        date: date ? new Date(date) : undefined,
        validUntil: validUntil ? new Date(validUntil) : null,
        subtotal,
        discount: totalDiscount,
        tax: totalTax,
        total,
        items: {
          deleteMany: {}, // Remove all existing items
          create: processedItems // Add the new items
        }
      },
      include: { items: true },
    });

    res.status(200).json({ status: 'success', data: { quotation } });
  } catch (error: any) {
    console.error('Error updating quotation:', error);
    res.status(400).json({ status: 'error', message: `Error updating quotation: ${error.message || error}` });
  }
};

export const updateQuotationStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { status } = req.body;

  if (!status) {
    res.status(400).json({ status: 'error', message: 'Status is required' });
    return;
  }

  try {
    const quotation = await prisma.quotation.update({
      where: { id },
      data: { status },
    });
    res.status(200).json({ status: 'success', data: { quotation } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error updating quotation status' });
  }
};
