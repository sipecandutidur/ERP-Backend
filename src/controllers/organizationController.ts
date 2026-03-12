import { Request, Response } from 'express';
import prisma from '../prisma';

export const getOrganizations = async (req: Request, res: Response): Promise<void> => {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ status: 'success', data: { organizations } });
};

export const getOrganizationById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const organization = await prisma.organization.findUnique({
    where: { id },
  });

  if (!organization) {
    res.status(404).json({ status: 'error', message: 'Organization not found' });
    return;
  }

  res.status(200).json({ status: 'success', data: { organization } });
};

export const createOrganization = async (req: Request, res: Response): Promise<void> => {
  const { name, address, phone, email, website, npwp } = req.body;

  if (!name) {
    res.status(400).json({ status: 'error', message: 'Name is required' });
    return;
  }

  // Check for existing organization to prevent duplicates
  const existingOrganization = await prisma.organization.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } }
  });

  if (existingOrganization) {
    res.status(400).json({ status: 'error', message: 'Organization with this name already exists' });
    return;
  }

  // Auto-generate code e.g. ORG-0001
  const lastOrg = await prisma.organization.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  let code = 'ORG-0001';
  if (lastOrg && lastOrg.code.startsWith('ORG-')) {
    const lastNumber = parseInt(lastOrg.code.replace('ORG-', ''), 10);
    if (!isNaN(lastNumber)) {
      code = `ORG-${(lastNumber + 1).toString().padStart(4, '0')}`;
    }
  } else if (lastOrg) {
     const count = await prisma.organization.count();
     code = `ORG-${(count + 1).toString().padStart(4, '0')}`;
  }

  const organization = await prisma.organization.create({
    data: {
      code,
      name,
      address,
      phone,
      email,
      website,
      npwp,
    },
  });

  res.status(201).json({ status: 'success', data: { organization } });
};

export const updateOrganization = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { name, address, phone, email, website, npwp } = req.body;

  const dataToUpdate: any = {};
  if (name) dataToUpdate.name = name;
  if (address !== undefined) dataToUpdate.address = address;
  if (phone !== undefined) dataToUpdate.phone = phone;
  if (email !== undefined) dataToUpdate.email = email;
  if (website !== undefined) dataToUpdate.website = website;
  if (npwp !== undefined) dataToUpdate.npwp = npwp;

  try {
    const organization = await prisma.organization.update({
      where: { id },
      data: dataToUpdate,
    });
    res.status(200).json({ status: 'success', data: { organization } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error updating organization' });
  }
};

export const deleteOrganization = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    await prisma.organization.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error deleting organization (ensure no associated customers exist)' });
  }
};
