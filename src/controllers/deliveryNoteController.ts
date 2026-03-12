import { Request, Response } from 'express';
import prisma from '../prisma';

export const getDeliveryNotes = async (req: Request, res: Response): Promise<void> => {
  const deliveryNotes = await prisma.deliveryNote.findMany({
    include: {
      quotation: {
        include: { customer: true }
      }
    },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json({ status: 'success', data: { deliveryNotes } });
};

export const getDeliveryNoteById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const deliveryNote = await prisma.deliveryNote.findUnique({
    where: { id },
    include: {
      quotation: {
        include: {
          customer: {
            include: { organization: true }
          },
          project: true // Include project data
        }
      },
      items: {
        include: { item: true }
      }
    },
  });

  if (!deliveryNote) {
    res.status(404).json({ status: 'error', message: 'Delivery Note not found' });
    return;
  }

  res.status(200).json({ status: 'success', data: { deliveryNote } });
};

export const createDeliveryNote = async (req: Request, res: Response): Promise<void> => {
  const { dnNumber, quotationId, driverName, vehicleNumber, items } = req.body;

  if (!dnNumber || !items || items.length === 0) {
    res.status(400).json({ status: 'error', message: 'dnNumber and items are required' });
    return;
  }

  const existingDn = await prisma.deliveryNote.findUnique({ where: { dnNumber } });
  if (existingDn) {
    res.status(400).json({ status: 'error', message: 'Delivery Note number already exists' });
    return;
  }

  const processedItems = items.map((i: any) => ({
    itemId: i.itemId,
    quantityLoad: i.quantityLoad,
    quantitySent: i.quantitySent || i.quantityLoad, // default equals to load
  }));

  const deliveryNote = await prisma.deliveryNote.create({
    data: {
      dnNumber,
      quotationId,
      driverName,
      vehicleNumber,
      items: {
        create: processedItems,
      }
    },
    include: { items: true },
  });

  res.status(201).json({ status: 'success', data: { deliveryNote } });
};

export const updateDeliveryNoteStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { status } = req.body;

  if (!status) {
    res.status(400).json({ status: 'error', message: 'Status is required' });
    return;
  }

  try {
    const deliveryNote = await prisma.deliveryNote.update({
      where: { id },
      data: { status },
    });
    res.status(200).json({ status: 'success', data: { deliveryNote } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error updating delivery note status' });
  }
};

export const generateFromQuotation = async (req: Request | any, res: Response): Promise<void> => {
  const { quotationId } = req.params;
  const { itemIds }: { itemIds?: string[] } = req.body || {};

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

  // Get highest sequence number for current month
  const currentYearMonth = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
  const lastDn = await prisma.deliveryNote.findFirst({
    where: { dnNumber: { startsWith: `DN-${currentYearMonth}-` } },
    orderBy: { dnNumber: 'desc' },
  });

  let currentSeq = 0;
  if (lastDn) {
    const parts = lastDn.dnNumber.split('-');
    if (parts.length === 3) {
      currentSeq = parseInt(parts[2], 10);
      if (isNaN(currentSeq)) currentSeq = 0;
    }
  }

  currentSeq++;
  const dnNumber: string = `DN-${currentYearMonth}-${currentSeq.toString().padStart(4, '0')}`;

  const processedItems = sourceItems.map((i: any) => ({
    itemId: i.itemId,
    quantityLoad: i.quantity,
    quantitySent: i.quantity,
  }));

  const deliveryNote = await prisma.deliveryNote.create({
    data: {
      dnNumber,
      quotationId: quotation.id,
      status: "PENDING",
      items: {
        create: processedItems
      }
    },
    include: { items: true }
  });

  res.status(201).json({ status: 'success', data: { deliveryNote } });
};

export const updateDeliveryNoteItem = async (req: Request, res: Response): Promise<void> => {
  const { id, itemId } = req.params as { id: string, itemId: string };
  const { quantitySent, note } = req.body;

  try {
    const item = await prisma.deliveryNoteItem.update({
      where: {
        id: itemId,
        deliveryNoteId: id, // Ensure item belongs to this DN
      },
      data: {
        quantitySent: quantitySent !== undefined ? Number(quantitySent) : undefined,
        note: note !== undefined ? String(note) : undefined,
      }
    });

    res.status(200).json({ status: 'success', data: { item } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error updating delivery note item' });
  }
};
