import { Request, Response } from 'express';
import prisma from '../prisma';

export const getRABByProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params as { id: string };

    let rab = await prisma.rAB.findUnique({
      where: { projectId },
      include: { items: true },
    });

    if (!rab) {
      // Auto-create an empty RAB if none exists when requested
      rab = await prisma.rAB.create({
        data: { projectId },
        include: { items: true },
      });
    }

    res.json({ success: true, data: rab });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add RAB Item
export const addRABItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params as { id: string };
    const { description, quantity, unit, unitPrice, status, supplier, itemId } = req.body;

    let rab = await prisma.rAB.findUnique({ where: { projectId } });
    if (!rab) {
       rab = await prisma.rAB.create({ data: { projectId } });
    }

    const totalPrice = Number(quantity) * Number(unitPrice);

    const newItem = await prisma.rABItem.create({
      data: {
        rabId: rab.id,
        itemId: itemId || null,
        description,
        quantity: Number(quantity),
        unit,
        unitPrice: Number(unitPrice),
        totalPrice,
        status: status || "REQUEST",
        supplier: supplier || null,
      },
    });

    // Update total estimated cost
    const updatedRab = await prisma.rAB.findUnique({
      where: { id: rab.id },
      include: { items: true }
    });

    const newTotal = updatedRab?.items.reduce((sum, item) => sum + item.totalPrice, 0) || 0;
    await prisma.rAB.update({
      where: { id: rab.id },
      data: { totalEstimatedCost: newTotal }
    });

    await prisma.project.update({
      where: { id: rab.projectId },
      data: { initialCapital: newTotal }
    });

    res.status(201).json({ success: true, data: newItem });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Auto-generate RAB from Linked Quotations
export const generateRABFromQuotation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params as { id: string };

    // Find the latest accepted or sent quotation for the project, or at least any quotation tied to this project
    const quotation = await prisma.quotation.findFirst({
      where: { projectId },
      orderBy: { date: 'desc' },
      include: {
        items: {
          include: {
            distributor: true, // we need distributor to lookup ItemDistributor
            item: true, // fetch item details directly from the relation
          }
        }
      }
    });

    if (!quotation) {
      console.log(`[RAB Generate] No quotation found for project ${projectId}`);
      res.status(404).json({ success: false, message: 'No Quotation found linked to this project. Please link a quotation first.' });
      return;
    }

    console.log(`[RAB Generate] Found Quotation ${quotation.id} with ${quotation.items.length} items`);

    // Ensure we have an active RAB for this project
    let rab = await prisma.rAB.findUnique({ where: { projectId } });
    if (!rab) {
       rab = await prisma.rAB.create({ data: { projectId } });
    }

    // Fetch existing RAB items indexed by itemId (for smart upsert)
    const existingItems = await prisma.rABItem.findMany({
      where: { rabId: rab.id },
    });
    const existingByItemId = new Map<string, typeof existingItems[0]>();
    for (const ei of existingItems) {
      if (ei.itemId) existingByItemId.set(ei.itemId, ei);
    }

    // Track which itemIds are in the new quotation (so we can remove obsolete ones)
    const incomingItemIds = new Set<string>(quotation.items.map((i: any) => i.itemId).filter(Boolean));

    // Lookup ItemDistributor for each QuotationItem to compute Unit Cost
    const rabItemPromises = quotation.items.map(async (qItem) => {
      let unitCost = qItem.price; // fallback to the selling price if no distributor data is found
      let description = qItem.item ? qItem.item.name : 'Material'; // Fallback descriptive name
      let suppName = "";

      // Use the pre-fetched item from the relation
      const itemNode = qItem.item;
      if (itemNode) {
        description = itemNode.name;
        if (itemNode.code) {
          description = `[${itemNode.code}] ${description}`;
        }

        // If distributor is mapped, try to fetch the backend modal/base price
        if (qItem.distributorId) {
          const itemDistributor = await prisma.itemDistributor.findUnique({
             where: {
               itemId_distributorId: {
                 itemId: qItem.itemId,
                 distributorId: qItem.distributorId
               }
             },
             include: { distributor: true }
          });

          if (itemDistributor) {
             suppName = itemDistributor.distributor.name;
             description += ` - ${suppName}`;

            const basePrice = itemDistributor.basePrice;
            const discountPct = itemDistributor.discount;
            const taxPct = itemDistributor.tax;

            const netPrice = basePrice - (basePrice * (discountPct / 100));
            const taxYield = netPrice * (taxPct / 100);
            unitCost = netPrice + taxYield;
          }
        }
      }

      const totalPrice = unitCost * qItem.quantity;

      const existing = qItem.itemId ? existingByItemId.get(qItem.itemId) : null;

      if (existing) {
        // Update prices/description but PRESERVE the existing status
        return prisma.rABItem.update({
          where: { id: existing.id },
          data: {
            description,
            quantity: qItem.quantity,
            unit: itemNode?.unit || existing.unit,
            unitPrice: unitCost,
            totalPrice,
            supplier: suppName || existing.supplier,
            // status intentionally NOT updated — keep current value
          },
        });
      } else {
        // New item — create with default status
        return prisma.rABItem.create({
          data: {
            rabId: rab!.id,
            itemId: qItem.itemId || null,
            description,
            quantity: qItem.quantity,
            unit: itemNode?.unit || "Unit",
            unitPrice: unitCost,
            totalPrice,
            supplier: suppName || null,
          },
        });
      }
    });

    // Remove RABItems that were linked to an itemId no longer in the quotation
    const obsoleteItems = existingItems.filter(
      (ei) => ei.itemId && !incomingItemIds.has(ei.itemId)
    );
    if (obsoleteItems.length > 0) {
      await prisma.rABItem.deleteMany({
        where: { id: { in: obsoleteItems.map((i) => i.id) } },
      });
    }

    await Promise.all(rabItemPromises);

    // Update total estimated cost
    const updatedRab = await prisma.rAB.findUnique({
      where: { id: rab.id },
      include: { items: true }
    });

    const newTotal = updatedRab?.items.reduce((sum, item) => sum + item.totalPrice, 0) || 0;
    await prisma.rAB.update({
      where: { id: rab.id },
      data: { totalEstimatedCost: newTotal }
    });

    await prisma.project.update({
      where: { id: rab.projectId },
      data: { initialCapital: newTotal }
    });

    console.log(`[RAB Generate] Successfully generated ${rabItemPromises.length} items. New total: ${newTotal}`);

    res.status(200).json({ success: true, message: 'RAB successfully generated from Quotation', data: updatedRab });
  } catch (error: any) {
    console.error('[RAB Generation Error]', error.stack || error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update RAB Item
export const updateRABItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const { description, quantity, unit, unitPrice, status, supplier } = req.body;

    const totalPrice = Number(quantity) * Number(unitPrice);

    const updatedItem = await prisma.rABItem.update({
      where: { id },
      data: {
        description,
        quantity: Number(quantity),
        unit,
        unitPrice: Number(unitPrice),
        totalPrice,
        status,
        supplier,
      },
    });

    // Update total
    const rab = await prisma.rAB.findUnique({
      where: { id: updatedItem.rabId },
      include: { items: true }
    });

    const newTotal = rab?.items.reduce((sum, item) => sum + item.totalPrice, 0) || 0;
    await prisma.rAB.update({
      where: { id: updatedItem.rabId },
      data: { totalEstimatedCost: newTotal }
    });

    if (rab) {
      await prisma.project.update({
        where: { id: rab.projectId },
        data: { initialCapital: newTotal }
      });
    }

    res.json({ success: true, data: updatedItem });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete RAB Item
export const deleteRABItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    const item = await prisma.rABItem.delete({
      where: { id },
    });

    // Update total
    const rab = await prisma.rAB.findUnique({
      where: { id: item.rabId },
      include: { items: true }
    });

    const newTotal = rab?.items.reduce((sum, i) => sum + i.totalPrice, 0) || 0;
    await prisma.rAB.update({
      where: { id: item.rabId },
      data: { totalEstimatedCost: newTotal }
    });

    if (rab) {
      await prisma.project.update({
        where: { id: rab.projectId },
        data: { initialCapital: newTotal }
      });
    }

    res.json({ success: true, message: 'RAB Item deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
