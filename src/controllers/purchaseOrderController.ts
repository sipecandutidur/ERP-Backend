import { Request, Response } from 'express';
import prisma from '../prisma';
import { bankersRound } from '../utils/math';

export const getPurchaseOrders = async (req: Request, res: Response): Promise<void> => {
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    include: {
      distributor: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ status: 'success', data: { purchaseOrders } });
};

export const getPurchaseOrderById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      distributor: true,
      user: { select: { id: true, name: true } },
      items: {
        include: { item: true }
      }
    },
  });

  if (!po) {
    res.status(404).json({ status: 'error', message: 'Purchase Order not found' });
    return;
  }

  res.status(200).json({ status: 'success', data: { purchaseOrder: po } });
};

export const updatePurchaseOrderStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { status } = req.body;

  if (!status) {
    res.status(400).json({ status: 'error', message: 'Status is required' });
    return;
  }

  try {
    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: { status },
    });
    res.status(200).json({ status: 'success', data: { purchaseOrder } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error updating purchase order status' });
  }
};

export const updatePurchaseOrderItemStatus = async (req: Request, res: Response): Promise<void> => {
  const { id, itemId } = req.params as { id: string, itemId: string };
  const { fulfillmentStatus } = req.body;

  if (!fulfillmentStatus) {
    res.status(400).json({ status: 'error', message: 'Fulfillment status is required' });
    return;
  }

  try {
    const item = await prisma.purchaseOrderItem.update({
      where: { id: itemId, purchaseOrderId: id },
      data: { fulfillmentStatus },
    });
    res.status(200).json({ status: 'success', data: { item } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error updating item fulfillment status' });
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
      let taxRate = 0;
      const distInfo = qi.item.itemDistributors.find((d: any) => d.distributorId === qi.distributorId);
      if (distInfo) {
        basePrice = distInfo.basePrice || 0;
        taxRate = distInfo.tax || 0;
      }

      // Calculation logic based on item parameters
      const rowSubtotal = basePrice * qi.quantity;
      const rowTaxAmount = bankersRound(rowSubtotal * (taxRate / 100));
      const rowFinalTotal = rowSubtotal + rowTaxAmount;

      itemsByDistributor[qi.distributorId].push({
        itemId: qi.itemId,
        quantity: qi.quantity,
        price: basePrice, // Store absolute base price
        total: rowSubtotal, // Item total is just Qty * Unit Price
        taxAmount: rowTaxAmount, // Add tax object for Grand Total sum
      });
    }
  });

  // Get highest sequence number for current month
  const currentYearMonth = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
  const lastPo = await prisma.purchaseOrder.findFirst({
    where: { poNumber: { startsWith: `PO-${currentYearMonth}-` } },
    orderBy: { poNumber: 'desc' },
  });

  let currentSeq = 0;
  if (lastPo) {
    const parts = lastPo.poNumber.split('-');
    if (parts.length === 3) {
      currentSeq = parseInt(parts[2], 10);
      if (isNaN(currentSeq)) currentSeq = 0;
    }
  }

  const generatedPOs = [];

  for (const distributorId of Object.keys(itemsByDistributor)) {
    const items = itemsByDistributor[distributorId];

    // Auto-generate PO Number
    currentSeq++;
    const poNum: string = `PO-${currentYearMonth}-${currentSeq.toString().padStart(4, '0')}`;

    const total = items.reduce((sum, item) => sum + item.total + item.taxAmount, 0);

    // Filter out the taxAmount helper property before database insertion
    const itemsData = items.map((i) => ({
      itemId: i.itemId,
      quantity: i.quantity,
      price: i.price,
      total: i.total
    }));

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: poNum,
        distributorId,
        userId,
        projectCode: quotation.project?.code || null,
        total,
        items: {
          create: itemsData,
        }
      }
    });
    generatedPOs.push(po);
  }

  res.status(201).json({ status: 'success', data: { generatedPurchaseOrders: generatedPOs } });
};
