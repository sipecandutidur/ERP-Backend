import { Request, Response } from 'express';
import prisma from '../prisma';
import { bankersRound } from '../utils/math';

export const getVendorQuotations = async (req: Request, res: Response): Promise<void> => {
  const vendorQuotations = await prisma.vendorQuotation.findMany({
    include: {
      distributor: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ status: 'success', data: { vendorQuotations } });
};

export const getVendorQuotationById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const vq = await prisma.vendorQuotation.findUnique({
    where: { id },
    include: {
      distributor: true,
      user: { select: { id: true, name: true } },
      items: {
        include: { item: true }
      }
    },
  });

  if (!vq) {
    res.status(404).json({ status: 'error', message: 'Vendor Quotation not found' });
    return;
  }

  res.status(200).json({ status: 'success', data: { vendorQuotation: vq } });
};

export const createVendorQuotation = async (req: Request | any, res: Response): Promise<void> => {
  const { vqNumber, distributorId, items } = req.body;
  const userId = req.user?.id;

  if (!vqNumber || !distributorId || !items || items.length === 0) {
    res.status(400).json({ status: 'error', message: 'Missing required fields' });
    return;
  }

  const existingQuote = await prisma.vendorQuotation.findUnique({ where: { vqNumber } });
  if (existingQuote) {
    res.status(400).json({ status: 'error', message: 'Vendor Quote number already exists' });
    return;
  }

  let total = 0;
  const processedItems = items.map((i: any) => {
    const itemTotal = i.quantity * i.price;
    total += itemTotal;
    return {
      itemId: i.itemId,
      quantity: i.quantity,
      price: i.price,
      total: itemTotal,
    };
  });

  const vendorQuotation = await prisma.vendorQuotation.create({
    data: {
      vqNumber,
      distributorId,
      userId,
      total,
      items: {
        create: processedItems
      }
    },
    include: { items: true },
  });

  res.status(201).json({ status: 'success', data: { vendorQuotation } });
};

export const updateVendorQuotationStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { status } = req.body;

  if (!status) {
    res.status(400).json({ status: 'error', message: 'Status is required' });
    return;
  }

  try {
    const vendorQuotation = await prisma.vendorQuotation.update({
      where: { id },
      data: { status },
    });
    res.status(200).json({ status: 'success', data: { vendorQuotation } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error updating vendor quotation status' });
  }
};

export const generateFromQuotation = async (req: Request | any, res: Response): Promise<void> => {
  const { quotationId } = req.params;
  const userId = req.user?.id;
  // Optional: only include specific quotation item IDs
  const { itemIds }: { itemIds?: string[] } = req.body || {};

  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      items: {
        include: {
          item: {
            include: { itemDistributors: true }
          }
        }
      },
      project: true
    }
  }) as any;

  if (!quotation) {
    res.status(404).json({ status: 'error', message: 'Quotation not found' });
    return;
  }

  // Filter items if specific IDs were provided
  const sourceItems = (itemIds && itemIds.length > 0)
    ? quotation.items.filter((qi: any) => itemIds.includes(qi.id))
    : quotation.items;

  // Group items by distributor
  const itemsByDistributor: Record<string, any[]> = {};

  sourceItems.forEach((qi: any) => {
    if (qi.distributorId) {
      if (!itemsByDistributor[qi.distributorId]) {
        itemsByDistributor[qi.distributorId] = [];
      }

      let basePrice = 0;
      let tax = 0;
      const distInfo = qi.item.itemDistributors.find((d: any) => d.distributorId === qi.distributorId);
      if (distInfo) {
        basePrice = distInfo.basePrice || 0;
        tax = distInfo.tax || 0;
      }

      // Calculation logic based on item parameters
      const rowSubtotal = basePrice * qi.quantity;
      const rowTaxAmount = bankersRound(rowSubtotal * (tax / 100));
      const rowFinalTotal = rowSubtotal + rowTaxAmount;

      itemsByDistributor[qi.distributorId].push({
        itemId: qi.itemId,
        quantity: qi.quantity,
        price: basePrice, // Store absolute base price
        total: rowFinalTotal,
      });
    }
  });

  // Get highest sequence number for current month
  const currentYearMonth = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
  const lastVq = await prisma.vendorQuotation.findFirst({
    where: { vqNumber: { startsWith: `VQ-${currentYearMonth}-` } },
    orderBy: { vqNumber: 'desc' },
  });

  let currentSeq = 0;
  if (lastVq) {
    const parts = lastVq.vqNumber.split('-');
    if (parts.length === 3) {
      currentSeq = parseInt(parts[2], 10);
      if (isNaN(currentSeq)) currentSeq = 0;
    }
  }

  const generatedQuotes = [];

  for (const distributorId of Object.keys(itemsByDistributor)) {
    const items = itemsByDistributor[distributorId];

    // Auto-generate VQ Number
    currentSeq++;
    const vqNum: string = `VQ-${currentYearMonth}-${currentSeq.toString().padStart(4, '0')}`;

    const total = items.reduce((sum, item) => sum + item.total, 0);

    const vendorQuote = await prisma.vendorQuotation.create({
      data: {
        vqNumber: vqNum,
        distributorId,
        userId,
        projectCode: quotation.project?.code || null,
        total,
        items: {
          create: items,
        }
      }
    });
    generatedQuotes.push(vendorQuote);
  }

  res.status(201).json({ status: 'success', data: { generatedQuotes } });
};
