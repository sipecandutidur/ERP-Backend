import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../prisma';

export const createUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password, name, roleName } = req.body;

  if (!email || !password || !name || !roleName) {
    res.status(400).json({ status: 'error', message: 'All fields are required' });
    return;
  }

  // Find or create the role
  let role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    role = await prisma.role.create({
      data: { name: roleName, description: `${roleName} Role` },
    });
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    res.status(400).json({ status: 'error', message: 'User already exists' });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      roleId: role.id,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: { select: { id: true, name: true } },
      createdAt: true,
    },
  });

  res.status(201).json({ status: 'success', data: { user } });
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: { select: { id: true, name: true } },
      createdAt: true,
    },
  });
  res.status(200).json({ status: 'success', data: { users } });
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: { select: { id: true, name: true } },
      createdAt: true,
    },
  });

  if (!user) {
    res.status(404).json({ status: 'error', message: 'User not found' });
    return;
  }

  res.status(200).json({ status: 'success', data: { user } });
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { name, roleId, roleName, password } = req.body;

  const dataToUpdate: any = {};
  if (name) dataToUpdate.name = name;
  if (roleId) dataToUpdate.roleId = roleId;
  // Support roleName in addition to roleId for convenience
  if (roleName && !roleId) {
    let role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      role = await prisma.role.create({
        data: { name: roleName, description: `${roleName} Role` },
      });
    }
    dataToUpdate.roleId = role.id;
  }
  if (password) {
    dataToUpdate.password = await bcrypt.hash(password, 10);
  }

  const user = await prisma.user.update({
    where: { id },
    data: dataToUpdate,
    select: {
      id: true,
      email: true,
      name: true,
      role: { select: { id: true, name: true } },
    },
  });

  res.status(200).json({ status: 'success', data: { user } });
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  await prisma.user.delete({ where: { id } });
  res.status(204).send();
};
