import { Request, Response } from 'express';
import prisma from '../prisma';
import { bankersRound } from '../utils/math';
import { logActivity } from '../utils/auditLogger';
import { AuthRequest } from '../middlewares/authMiddleware';

// Trigger restart to load new Prisma Client

export const getVendorQuotations = async (req: Request, res: Response): Promise<void> => {
  const vendorQuotations = await (prisma.vendorQuotation as any).findMany({
    include: {
      distributor: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' }
  });

  const projectCodes = [...new Set(vendorQuotations.map((vq: any) => vq.projectCode).filter(Boolean))] as string[];
  const projects = projectCodes.length > 0
    ? await (prisma.project as any).findMany({
        where: { code: { in: projectCodes } },
        select: { id: true, code: true, name: true },
      })
    : [];
  const projectByCode = new Map(projects.map((p: any) => [p.code, p]));

  const enriched = vendorQuotations.map((vq: any) => ({
    ...vq,
    project: vq.projectCode ? (projectByCode.get(vq.projectCode) ?? null) : null,
  }));

  res.status(200).json({ status: 'success', data: { vendorQuotations: enriched } });
};

export const getVendorQuotationById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const vq = await (prisma.vendorQuotation as any).findUnique({
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

  let project = null;
  if (vq.projectCode) {
    project = await (prisma.project as any).findUnique({
      where: { code: vq.projectCode },
      select: { id: true, code: true, name: true },
    });
  }

  res.status(200).json({ status: 'success', data: { vendorQuotation: { ...vq, project } } });
};

export const createVendorQuotation = async (req: Request | any, res: Response): Promise<void> => {
  const { vqNumber, distributorId, items } = req.body;
  const userId = req.user?.id;

  if (!vqNumber || !distributorId || !items || items.length === 0) {
    res.status(400).json({ status: 'error', message: 'Missing required fields' });
    return;
  }

  const existingQuote = await (prisma.vendorQuotation as any).findUnique({ where: { vqNumber } });
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

  const vendorQuotation = await (prisma.vendorQuotation as any).create({
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

  await logActivity({
    action: 'CREATE',
    entity: 'VendorQuotation',
    entityId: vendorQuotation.id,
    details: `Vendor Quotation "${vendorQuotation.vqNumber}" created`,
    userId: (req as AuthRequest).user?.id,
    userName: (req as AuthRequest).user?.name,
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
    const vendorQuotation = await (prisma.vendorQuotation as any).update({
      where: { id },
      data: { status },
    });
    await logActivity({
      action: 'UPDATE_STATUS',
      entity: 'VendorQuotation',
      entityId: vendorQuotation.id,
      details: `Vendor Quotation "${vendorQuotation.vqNumber}" status updated to ${status}`,
      userId: (req as AuthRequest).user?.id,
      userName: (req as AuthRequest).user?.name,
    });

    res.status(200).json({ status: 'success', data: { vendorQuotation } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error updating vendor quotation status' });
  }
};

export const generateFromQuotation = async (req: Request | any, res: Response): Promise<void> => {
  try {
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
        let tax = 0;
        const distInfo = qi.item.itemDistributors.find((d: any) => d.distributorId === qi.distributorId);
        if (distInfo) {
          basePrice = distInfo.basePrice || 0;
          tax = distInfo.tax || 0;
        }

        const rowSubtotal = basePrice * qi.quantity;
        const rowTaxAmount = bankersRound(rowSubtotal * (tax / 100));
        const rowFinalTotal = rowSubtotal + rowTaxAmount;

        itemsByDistributor[qi.distributorId].push({
          itemId: qi.itemId,
          quantity: qi.quantity,
          price: basePrice,
          total: rowFinalTotal,
        });
      }
    });

    const currentYearMonth = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const lastVq = await (prisma.vendorQuotation as any).findFirst({
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
      const vqItems = itemsByDistributor[distributorId];

      currentSeq++;
      const vqNum: string = `VQ-${currentYearMonth}-${currentSeq.toString().padStart(4, '0')}`;

      const total = vqItems.reduce((sum, item) => sum + item.total, 0);

      const vendorQuote = await (prisma.vendorQuotation as any).create({
        data: {
          vqNumber: vqNum,
          distributorId,
          userId,
          projectCode: (quotation as any).project?.code || null,
          total,
          items: {
            create: vqItems,
          }
        }
      });

      await logActivity({
        action: 'CREATE',
        entity: 'VendorQuotation',
        entityId: vendorQuote.id,
        details: `Vendor Quotation "${vendorQuote.vqNumber}" generated from Quotation`,
        userId: (req as AuthRequest).user?.id,
        userName: (req as AuthRequest).user?.name,
      });

      generatedQuotes.push(vendorQuote);
    }

    res.status(201).json({ status: 'success', data: { generatedQuotes } });
  } catch (error) {
    console.error("Generate VQ error:", error);
    res.status(500).json({ status: 'error', message: 'Error generating vendor quotation' });
  }
};
