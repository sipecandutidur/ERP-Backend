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
    const { description, quantity, unit, unitPrice, status, supplier } = req.body;

    let rab = await prisma.rAB.findUnique({ where: { projectId } });
    if (!rab) {
       rab = await prisma.rAB.create({ data: { projectId } });
    }

    const totalPrice = Number(quantity) * Number(unitPrice);

    const newItem = await prisma.rABItem.create({
      data: {
        rabId: rab.id,
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

    // Clear existing RAB items to prevent duplicates when regenerating
    await prisma.rABItem.deleteMany({
      where: { rabId: rab.id }
    });

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
             include: { distributor: true } // We need to fetch the distributor details specifically for the name
          });

          if (itemDistributor) {
             suppName = itemDistributor.distributor.name;
             description += ` - ${suppName}`;

            // Formula: Unit Price = (Base Price - (Base Price * (Discount / 100))) * (1 + (Tax / 100))
            const basePrice = itemDistributor.basePrice;
            const discountPct = itemDistributor.discount;
            const taxPct = itemDistributor.tax;

            const netPrice = basePrice - (basePrice * (discountPct / 100));
            // User requested tax to be applied. Some apply tax additively on net.
            // Formula specified: (Base Price - (Base Price*Disc%)) + ((Base Price - (Base Price*Disc%)) * Tax%)
            const taxYield = netPrice * (taxPct / 100);
            unitCost = netPrice + taxYield;
          }
        }
      }

      const totalPrice = unitCost * qItem.quantity;

      // We don't want to duplicate items if they're already generated, but for simplicity we'll just append for now.
      // Easiest is to create new RAB items
      return prisma.rABItem.create({
        data: {
          rabId: rab!.id,
          description: description,
          quantity: qItem.quantity,
          unit: itemNode?.unit || "Unit",
          unitPrice: unitCost,
          totalPrice: totalPrice,
          supplier: suppName || null,
        }
      });
    });

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

    console.log(`[RAB Generate] Successfully generated ${rabItemPromises.length} items. New total: ${newTotal}`);

    res.status(200).json({ success: true, message: 'RAB successfully generated from Quotation', data: updatedRab });
  } catch (error: any) {
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

    res.json({ success: true, message: 'RAB Item deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
