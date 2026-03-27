import { Request, Response } from 'express';
import prisma from '../prisma';

export const getExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    const expenses = await (prisma.expense as any).findMany({
      include: {
        project: {
          select: { name: true, code: true }
        }
      },
      orderBy: { date: 'desc' },
    });
    res.status(200).json({ status: 'success', data: { expenses } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch expenses' });
  }
};

export const getExpensesByProject = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    const expenses = await (prisma.expense as any).findMany({
      where: { projectId: id },
      orderBy: { date: 'desc' },
    });
    res.status(200).json({ status: 'success', data: { expenses } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch expenses' });
  }
};

export const createExpense = async (req: Request, res: Response): Promise<void> => {
  const { date, projectId, description, amount, category, receipt } = req.body;

  if (!description || !amount) {
    res.status(400).json({ status: 'error', message: 'Description and amount are required' });
    return;
  }

  try {
    const currentYearMonth = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const lastExpense = await (prisma.expense as any).findFirst({
      where: { expenseNumber: { startsWith: `EXP-${currentYearMonth}-` } },
      orderBy: { expenseNumber: 'desc' },
    });

    let currentSeq = 0;
    if (lastExpense) {
      const parts = lastExpense.expenseNumber.split('-');
      if (parts.length === 3) {
        currentSeq = parseInt(parts[2], 10);
        if (isNaN(currentSeq)) currentSeq = 0;
      }
    }
    currentSeq++;
    const expenseNumber = `EXP-${currentYearMonth}-${currentSeq.toString().padStart(4, '0')}`;

    const expense = await (prisma.expense as any).create({
      data: {
        expenseNumber,
        projectId,
        description,
        amount,
        category,
        receipt,
        cashFlowTransaction: {
          create: {
            date: date ? new Date(date) : new Date(),
            type: 'EXPENSE',
            amount,
            description,
            category,
          }
        }
      },
    });

    res.status(201).json({ status: 'success', data: { expense } });
  } catch (error) {
    console.error("Create expense error:", error);
    res.status(500).json({ status: 'error', message: 'Failed to record expense' });
  }
};

export const updateExpense = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { date, description, amount, category, receipt } = req.body;
  try {
    const expense = await (prisma.expense as any).update({
      where: { id },
      data: {
        date: date ? new Date(date) : undefined,
        description,
        amount,
        category,
        receipt,
      },
    });
    res.status(200).json({ status: 'success', data: { expense } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error updating expense' });
  }
};

export const deleteExpense = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    await (prisma.expense as any).delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ status: 'error', message: 'Error deleting expense' });
  }
};
