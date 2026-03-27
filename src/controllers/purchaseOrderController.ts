import { Request, Response } from 'express';
import prisma from '../prisma';
import { bankersRound } from '../utils/math';
import { logActivity } from '../utils/auditLogger';
import { AuthRequest } from '../middlewares/authMiddleware';

export const getPurchaseOrders = async (req: Request, res: Response): Promise<void> => {
  const purchaseOrders = await (prisma.purchaseOrder as any).findMany({
    include: {
      distributor: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' }
  });

  const projectCodes = [...new Set(purchaseOrders.map((po: any) => po.projectCode).filter(Boolean))] as string[];
  const projects = projectCodes.length > 0
    ? await (prisma.project as any).findMany({
        where: { code: { in: projectCodes } },
        select: { id: true, code: true, name: true },
      })
    : [];
  const projectByCode = new Map(projects.map((p: any) => [p.code, p]));

  const enriched = purchaseOrders.map((po: any) => ({
    ...po,
    project: po.projectCode ? (projectByCode.get(po.projectCode) ?? null) : null,
  }));

  res.status(200).json({ status: 'success', data: { purchaseOrders: enriched } });
};

export const getPurchaseOrderById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const po = await (prisma.purchaseOrder as any).findUnique({
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

  let project = null;
  if (po.projectCode) {
    project = await (prisma.project as any).findUnique({
      where: { code: po.projectCode },
      select: { id: true, code: true, name: true },
    });
  }

  res.status(200).json({ status: 'success', data: { purchaseOrder: { ...po, project } } });
};

export const updatePurchaseOrderStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { status } = req.body;

  if (!status) {
    res.status(400).json({ status: 'error', message: 'Status is required' });
    return;
  }

  try {
    const po = await (prisma.purchaseOrder as any).findUnique({
      where: { id },
      include: { distributor: { select: { name: true } } },
    });

    if (!po) {
      res.status(404).json({ status: 'error', message: 'Purchase Order not found' });
      return;
    }

    const purchaseOrder = await (prisma.purchaseOrder as any).update({
      where: { id },
      data: { status },
    });

    if (status === 'COMPLETED' && po.status !== 'COMPLETED') {
      const vendorName = po.distributor?.name || 'Unknown Vendor';
      const description = `PO ${po.poNumber} - ${vendorName}`;

      const existing = await (prisma.cashFlowTransaction as any).findFirst({
        where: { description, type: 'EXPENSE' },
      });

      if (!existing) {
        await (prisma.cashFlowTransaction as any).create({
          data: {
            type: 'EXPENSE',
            amount: po.total,
            description,
            category: '5101 - Harga Pokok Penjualan',
            date: new Date(),
          },
        });
      }
    }

    await logActivity({
      action: 'UPDATE_STATUS',
      entity: 'PurchaseOrder',
      entityId: purchaseOrder.id,
      details: `Purchase Order "${purchaseOrder.poNumber}" status updated to ${status}`,
      userId: (req as AuthRequest).user?.id,
      userName: (req as AuthRequest).user?.name,
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
    const item = await (prisma.purchaseOrderItem as any).update({
      where: { id: itemId, purchaseOrderId: id },
      data: { fulfillmentStatus },
    });

    const statusMap: Record<string, string> = {
      REQUESTED: 'REQUEST',
      PAID: 'PAID',
      IN_WAREHOUSE: 'IN_WAREHOUSE',
      DELIVERED: 'DELIVERY',
    };
    const rabStatus = statusMap[fulfillmentStatus];

    if (rabStatus && item.itemId) {
      const po = await (prisma.purchaseOrder as any).findUnique({
        where: { id },
        select: { projectCode: true },
      });

      if (po?.projectCode) {
        const project = await (prisma.project as any).findUnique({
          where: { code: po.projectCode },
          select: { id: true, rab: { select: { id: true } } },
        });

        if (project?.rab?.id) {
          await (prisma.rABItem || (prisma as any).rabItem).updateMany({
            where: { rabId: project.rab.id, itemId: item.itemId },
            data: { status: rabStatus },
          });
        }
      }
    }

    await logActivity({
      action: 'UPDATE_ITEM_STATUS',
      entity: 'PurchaseOrder',
      entityId: id,
      details: `Item status in PO updated to ${fulfillmentStatus}`,
      userId: (req as AuthRequest).user?.id,
      userName: (req as AuthRequest).user?.name,
    });

    res.status(200).json({ status: 'success', data: { item } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error updating item fulfillment status' });
  }
};

export const generateFromQuotation = async (req: Request | any, res: Response): Promise<void> => {
  const { quotationId } = req.params;
  const userId = req.user?.id;
  const { itemIds }: { itemIds?: string[] } = req.body || {};

  const quotation = await (prisma.quotation as any).findUnique({
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
  });

  if (!quotation) {
    res.status(404).json({ status: 'error', message: 'Quotation not found' });
    return;
  }

  const sourceItems = (itemIds && itemIds.length > 0)
    ? quotation.items.filter((qi: any) => itemIds.includes(qi.id))
    : quotation.items;

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

      const rowSubtotal = basePrice * qi.quantity;
      const rowTaxAmount = bankersRound(rowSubtotal * (taxRate / 100));

      itemsByDistributor[qi.distributorId].push({
        itemId: qi.itemId,
        quantity: qi.quantity,
        price: basePrice,
        total: rowSubtotal,
        taxAmount: rowTaxAmount,
      });
    }
  });

  const currentYearMonth = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
  const lastPo = await (prisma.purchaseOrder as any).findFirst({
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
    const distItems = itemsByDistributor[distributorId];

    currentSeq++;
    const poNum: string = `PO-${currentYearMonth}-${currentSeq.toString().padStart(4, '0')}`;

    const total = distItems.reduce((sum, item) => sum + item.total + item.taxAmount, 0);

    const itemsData = distItems.map((i) => ({
      itemId: i.itemId,
      quantity: i.quantity,
      price: i.price,
      total: i.total
    }));

    const po = await (prisma.purchaseOrder as any).create({
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

  for (const po of generatedPOs) {
    await logActivity({
      action: 'CREATE',
      entity: 'PurchaseOrder',
      entityId: po.id,
      details: `Purchase Order "${po.poNumber}" generated from Quotation`,
      userId: (req as AuthRequest).user?.id,
      userName: (req as AuthRequest).user?.name,
    });
  }

  res.status(201).json({ status: 'success', data: { generatedPurchaseOrders: generatedPOs } });
};
