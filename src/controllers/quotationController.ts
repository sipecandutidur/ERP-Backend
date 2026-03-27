import { Request, Response } from 'express';
import prisma from '../prisma';
import { logActivity } from '../utils/auditLogger';

export const getQuotations = async (req: Request, res: Response): Promise<void> => {
  const quotations = await (prisma.quotation as any).findMany({
    include: {
      customer: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json({ status: 'success', data: { quotations } });
};

export const getQuotationById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const quotation = await (prisma.quotation as any).findUnique({
    where: { id },
    include: {
      customer: {
        include: { organization: true },
      },
      items: {
        include: { item: true, distributor: true },
      },
      project: true,
      user: {
        select: { name: true, email: true },
      },
    },
  });

  if (!quotation) {
    res.status(404).json({ status: 'error', message: 'Quotation not found' });
    return;
  }

  res.status(200).json({ status: 'success', data: { quotation } });
};

export const createQuotation = async (req: Request | any, res: Response): Promise<void> => {
  const { customerId, projectId, date, validUntil, subtotal, discount, tax, total, items } = req.body;

  console.log("Create Quotation Body:", JSON.stringify(req.body, null, 2));

  if (!customerId || !items || items.length === 0) {
    console.log("Validation failed:", { customerId: !!customerId, items: !!items, itemsLength: items?.length });
    res.status(400).json({ status: 'error', message: 'customerId and items are required' });
    return;
  }

  try {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const count = await (prisma.quotation as any).count({
      where: { createdAt: { gte: startOfMonth } }
    });
    const quoteNumber = `QUO-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(count + 1).toString().padStart(4, '0')}`;

    const quotation = await (prisma.quotation as any).create({
      data: {
        quoteNumber,
        customerId,
        projectId,
        userId: (req as any).user?.id,
        date: date ? new Date(date) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        subtotal: Number(subtotal) || 0,
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
        total: Number(total) || 0,
        items: {
          create: items.map((item: any) => ({
            itemId: item.itemId,
            quantity: Number(item.quantity),
            price: Number(item.price),
            total: Number(item.total),
            distributorId: item.distributorId,
            availability: item.availability,
            tax: Number(item.tax || 0),
          })),
        },
      },
    });

    await logActivity({
      action: 'CREATE',
      entity: 'Quotation',
      entityId: quotation.id,
      details: `Quotation "${quotation.quoteNumber}" created`,
      userId: req.user?.id,
      userName: req.user?.name,
    });

    res.status(201).json({ status: 'success', data: { quotation } });
  } catch (error: any) {
    console.error("Create quotation error:", error);
    if (error.code === 'P2002') {
      res.status(400).json({ status: 'error', message: 'Quotation number already exists' });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Failed to create quotation' });
  }
};

export const updateQuotation = async (req: Request | any, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { quoteNumber, customerId, projectId, date, validUntil, subtotal, discount, tax, total, items } = req.body;

  try {
    // Basic update logic: delete items and recreate them
    if (items) {
      await (prisma as any).quotationItem.deleteMany({ where: { quotationId: id } });
    }

    const quotation = await (prisma.quotation as any).update({
      where: { id },
      data: {
        quoteNumber: quoteNumber || undefined,
        customerId,
        projectId,
        date: date ? new Date(date) : undefined,
        validUntil: validUntil !== undefined ? (validUntil ? new Date(validUntil) : null) : undefined,
        subtotal: subtotal !== undefined ? Number(subtotal) : undefined,
        discount: discount !== undefined ? Number(discount) : undefined,
        tax: tax !== undefined ? Number(tax) : undefined,
        total: total !== undefined ? Number(total) : undefined,
        items: items ? {
          create: items.map((item: any) => ({
            itemId: item.itemId,
            quantity: Number(item.quantity),
            price: Number(item.price),
            total: Number(item.total),
            distributorId: item.distributorId,
            availability: item.availability,
            tax: Number(item.tax || 0),
          })),
        } : undefined,
      },
    });

    await logActivity({
      action: 'UPDATE',
      entity: 'Quotation',
      entityId: quotation.id,
      details: `Quotation "${quotation.quoteNumber}" updated`,
      userId: req.user?.id,
      userName: req.user?.name,
    });

    res.status(200).json({ status: 'success', data: { quotation } });
  } catch (error) {
    console.error("Update quotation error:", error);
    res.status(400).json({ status: 'error', message: 'Error updating quotation' });
  }
};

export const updateQuotationStatus = async (req: Request | any, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { status } = req.body;

  if (!status) {
    res.status(400).json({ status: 'error', message: 'Status is required' });
    return;
  }

  try {
    const quotation = await (prisma.quotation as any).update({
      where: { id },
      data: { status },
    });

    await logActivity({
      action: 'UPDATE_STATUS',
      entity: 'Quotation',
      entityId: quotation.id,
      details: `Quotation "${quotation.quoteNumber}" status updated to ${status}`,
      userId: req.user?.id,
      userName: req.user?.name,
    });

    res.status(200).json({ status: 'success', data: { quotation } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error updating quotation status' });
  }
};

export const deleteQuotation = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    await (prisma.quotation as any).delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error deleting quotation' });
  }
};
