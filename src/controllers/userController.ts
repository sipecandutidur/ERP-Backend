import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../prisma';

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
  const { name, roleId, password } = req.body;

  const dataToUpdate: any = {};
  if (name) dataToUpdate.name = name;
  if (roleId) dataToUpdate.roleId = roleId;
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
