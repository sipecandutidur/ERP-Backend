import { Request, Response } from 'express';
import prisma from '../prisma';

export const getCustomers = async (req: Request, res: Response): Promise<void> => {
  const customers = await (prisma.customer as any).findMany({
    include: { contacts: true, organization: true },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json({ status: 'success', data: { customers } });
};

export const getCustomerById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const customer = await (prisma.customer as any).findUnique({
    where: { id },
    include: { contacts: true, organization: true },
  });

  if (!customer) {
    res.status(404).json({ status: 'error', message: 'Customer not found' });
    return;
  }

  res.status(200).json({ status: 'success', data: { customer } });
};

export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  const { name, address, district, phone, email, npwp, organizationId, contacts } = req.body;

  if (!name) {
    res.status(400).json({ status: 'error', message: 'Name is required' });
    return;
  }

  // Check for existing customer to prevent duplicates
  const existingCustomer = await (prisma.customer as any).findFirst({
    where: { name: { equals: name, mode: 'insensitive' } }
  });

  if (existingCustomer) {
    res.status(400).json({ status: 'error', message: 'Customer with this name already exists' });
    return;
  }

  // Auto-generate code e.g. CUST-0001
  const lastCustomer = await (prisma.customer as any).findFirst({
    orderBy: { createdAt: 'desc' },
  });

  let code = 'CUST-0001';
  if (lastCustomer && lastCustomer.code.startsWith('CUST-')) {
    const lastNumber = parseInt(lastCustomer.code.replace('CUST-', ''), 10);
    if (!isNaN(lastNumber)) {
      code = `CUST-${(lastNumber + 1).toString().padStart(4, '0')}`;
    }
  } else if (lastCustomer) {
     // If last customer doesn't have CUST- prefix, fallback to count
     const count = await (prisma.customer as any).count();
     code = `CUST-${(count + 1).toString().padStart(4, '0')}`;
  }

  const customer = await (prisma.customer as any).create({
    data: {
      code,
      name,
      address,
      district,
      phone,
      email,
      npwp,
      organizationId,
      contacts: {
        create: contacts || [],
      },
    },
    include: { contacts: true, organization: true },
  });

  res.status(201).json({ status: 'success', data: { customer } });
};

export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { name, address, district, phone, email, npwp, organizationId } = req.body;

  const dataToUpdate: any = {};
  if (name) dataToUpdate.name = name;
  if (address !== undefined) dataToUpdate.address = address;
  if (district !== undefined) dataToUpdate.district = district;
  if (phone !== undefined) dataToUpdate.phone = phone;
  if (email !== undefined) dataToUpdate.email = email;
  if (npwp !== undefined) dataToUpdate.npwp = npwp;
  if (organizationId !== undefined) dataToUpdate.organizationId = organizationId;

  try {
    const customer = await (prisma.customer as any).update({
      where: { id },
      data: dataToUpdate,
      include: { contacts: true, organization: true },
    });
    res.status(200).json({ status: 'success', data: { customer } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error updating customer' });
  }
};

export const deleteCustomer = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    // Delete related contacts first
    await (prisma.contactPerson as any).deleteMany({ where: { customerId: id } });
    await (prisma.customer as any).delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error deleting customer or related records exist' });
  }
};
