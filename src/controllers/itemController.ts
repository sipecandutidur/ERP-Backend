import { Request, Response } from 'express';
import prisma from '../prisma';

export const getItems = async (req: Request, res: Response): Promise<void> => {
  const items = await prisma.item.findMany({
    include: {
      itemDistributors: {
        include: { distributor: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ status: 'success', data: { items } });
};

export const getItemById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      itemDistributors: {
        include: { distributor: true }
      }
    },
  });

  if (!item) {
    res.status(404).json({ status: 'error', message: 'Item not found' });
    return;
  }

  res.status(200).json({ status: 'success', data: { item } });
};

export const createItem = async (req: Request, res: Response): Promise<void> => {
  let { code, name, description, category, unit, stock, itemDistributors } = req.body;

  if (!name || !unit) {
    res.status(400).json({ status: 'error', message: 'Name and unit are required' });
    return;
  }

  if (code) {
    // If user provided code manually
    const existingItem = await prisma.item.findUnique({ where: { code } });
    if (existingItem) {
      res.status(400).json({ status: 'error', message: 'Item code already exists' });
      return;
    }
  } else {
    // Auto-generate code
    const count = await prisma.item.count();
    code = `ITEM-${(count + 1).toString().padStart(4, '0')}`;
  }

  const distributorsData = Array.isArray(itemDistributors) ? itemDistributors.map((d: any) => ({
    distributorId: d.distributorId,
    basePrice: Number(d.basePrice) || 0,
    discount: Number(d.discount) || 0,
    tax: Number(d.tax) || 0,
    margin: Number(d.margin) || 0,
    sellPrice: Number(d.sellPrice) || 0,
  })) : [];

  const item = await prisma.item.create({
    data: {
      code,
      name,
      description,
      category,
      unit,
      stock: stock || 0,
      itemDistributors: {
        create: distributorsData
      }
    },
    include: { itemDistributors: { include: { distributor: true } } },
  });

  res.status(201).json({ status: 'success', data: { item } });
};

export const updateItem = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { code, name, description, category, unit, stock, itemDistributors } = req.body;

  const dataToUpdate: any = {};
  if (code) dataToUpdate.code = code;
  if (name) dataToUpdate.name = name;
  if (description !== undefined) dataToUpdate.description = description;
  if (category !== undefined) dataToUpdate.category = category;
  if (unit) dataToUpdate.unit = unit;
  if (stock !== undefined) dataToUpdate.stock = stock;

  try {
    const itemToUpdate = await prisma.item.findUnique({ where: { id } });
    if (!itemToUpdate) {
      res.status(404).json({ status: 'error', message: 'Item not found' });
      return;
    }

    // Prepare update data
    const updateData: any = { ...dataToUpdate };

    // Handle nested ItemDistributor sync
    if (Array.isArray(itemDistributors)) {
      // First delete all existing distributors for this item
      await prisma.itemDistributor.deleteMany({
        where: { itemId: id }
      });

      // Then recreate them
      updateData.itemDistributors = {
        create: itemDistributors.map((d: any) => ({
          distributorId: d.distributorId,
          basePrice: Number(d.basePrice) || 0,
          discount: Number(d.discount) || 0,
          tax: Number(d.tax) || 0,
          margin: Number(d.margin) || 0,
          sellPrice: Number(d.sellPrice) || 0,
        }))
      };
    }

    const updatedItem = await prisma.item.update({
      where: { id },
      data: updateData,
      include: { itemDistributors: { include: { distributor: true } } },
    });

    res.status(200).json({ status: 'success', data: { item: updatedItem } });
  } catch (error) {
    console.error(error);
    res.status(400).json({ status: 'error', message: 'Error updating item' });
  }
};

export const deleteItem = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    await prisma.item.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error deleting item or related records exist' });
  }
};

export const importItems = async (req: Request, res: Response): Promise<void> => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    res.status(400).json({ status: 'error', message: 'Payload must be an array of items' });
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const itemPayload of items) {
        const { code, name, description, category, unit, stock, itemDistributors } = itemPayload;

        if (!name || !unit) continue; // Skip invalid rows safely

        const distributorsData = Array.isArray(itemDistributors) ? itemDistributors.map((d: any) => ({
          distributorId: d.distributorId,
          basePrice: Number(d.basePrice) || 0,
          discount: Number(d.discount) || 0,
          tax: Number(d.tax) || 0,
          margin: Number(d.margin) || 0,
          sellPrice: Number(d.sellPrice) || 0,
        })) : [];

        let finalCode = code;
        if (!finalCode) {
           const count = await tx.item.count();
           // generate a random enough code fallback to avoid collisions in bulk
           finalCode = `ITEM-${Date.now().toString().slice(-4)}-${(count + 1).toString().padStart(4, '0')}`;
        }

        // Check exist by exact code
        const existingInfo = await tx.item.findUnique({ where: { code: finalCode } });

        if (existingInfo) {
           // Update existing item
           await tx.itemDistributor.deleteMany({ where: { itemId: existingInfo.id }});
           await tx.item.update({
              where: { id: existingInfo.id },
              data: {
                 name: name || existingInfo.name,
                 description: description || existingInfo.description,
                 category: category || existingInfo.category,
                 unit: unit || existingInfo.unit,
                 stock: stock !== undefined ? Number(stock) : existingInfo.stock,
                 itemDistributors: { create: distributorsData }
              }
           });
        } else {
           // Create new item
           await tx.item.create({
              data: {
                  code: finalCode,
                  name,
                  description: description || '',
                  category: category || 'General',
                  unit,
                  stock: Number(stock) || 0,
                  itemDistributors: { create: distributorsData }
              }
           });
        }
      }
    });

    res.status(200).json({ status: 'success', message: `${items.length} items processed` });
  } catch (err: any) {
    console.error('Import Error:', err);
    res.status(500).json({ status: 'error', message: err.message || 'Bulk import failed' });
  }
};
