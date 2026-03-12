import { Request, Response } from 'express';
import prisma from '../prisma';

export const getDistributors = async (req: Request, res: Response): Promise<void> => {
  const distributors = await prisma.distributor.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ status: 'success', data: { distributors } });
};

export const getDistributorById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const distributor = await prisma.distributor.findUnique({
    where: { id },
  });

  if (!distributor) {
    res.status(404).json({ status: 'error', message: 'Distributor not found' });
    return;
  }

  res.status(200).json({ status: 'success', data: { distributor } });
};

export const createDistributor = async (req: Request, res: Response): Promise<void> => {
  const { name, address, district, phone, email, website, npwp, bankName, bankAccountName, bankAccountNumber } = req.body;

  if (!name) {
    res.status(400).json({ status: 'error', message: 'Name is required' });
    return;
  }

  // Check for existing distributor to prevent duplicates
  const existingDistributor = await prisma.distributor.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } }
  });

  if (existingDistributor) {
    res.status(400).json({ status: 'error', message: 'Distributor with this name already exists' });
    return;
  }

  // Auto-generate code e.g. DIST-0001
  const lastDistributor = await prisma.distributor.findFirst({
    orderBy: { id: 'desc' }, // Assuming id is UUID, it might not sort perfectly by creation time, but no createdAt field exists
  });

  // Actually, we don't have createdAt on distributor according to the snippet, or maybe we do? Let's use count.
  const count = await prisma.distributor.count();
  const code = `DIST-${(count + 1).toString().padStart(4, '0')}`;

  const distributor = await prisma.distributor.create({
    data: { code, name, address, district, phone, email, website, npwp, bankName, bankAccountName, bankAccountNumber },
  });

  res.status(201).json({ status: 'success', data: { distributor } });
};

export const updateDistributor = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { name, address, district, phone, email, website, npwp, bankName, bankAccountName, bankAccountNumber } = req.body;

  const dataToUpdate: any = {};
  if (name) dataToUpdate.name = name;
  if (address !== undefined) dataToUpdate.address = address;
  if (district !== undefined) dataToUpdate.district = district;
  if (phone !== undefined) dataToUpdate.phone = phone;
  if (email !== undefined) dataToUpdate.email = email;
  if (website !== undefined) dataToUpdate.website = website;
  if (npwp !== undefined) dataToUpdate.npwp = npwp;
  if (bankName !== undefined) dataToUpdate.bankName = bankName;
  if (bankAccountName !== undefined) dataToUpdate.bankAccountName = bankAccountName;
  if (bankAccountNumber !== undefined) dataToUpdate.bankAccountNumber = bankAccountNumber;

  try {
    const distributor = await prisma.distributor.update({
      where: { id },
      data: dataToUpdate,
    });
    res.status(200).json({ status: 'success', data: { distributor } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error updating distributor' });
  }
};

export const deleteDistributor = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    await prisma.distributor.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error deleting distributor or related records exist' });
  }
};
