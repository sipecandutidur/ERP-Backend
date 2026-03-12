import { Request, Response } from 'express';
import prisma from '../prisma';

// Get Expenses by Project ID
export const getExpensesByProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params as { id: string };

    const expenses = await prisma.expense.findMany({
      where: { projectId },
      orderBy: { date: 'desc' },
    });

    res.json({ success: true, data: expenses });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Expense
export const createExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: projectId } = req.params as { id: string };
    const { expenseNumber, date, description, amount, category, receipt } = req.body;

    // Check unique expense number
    if (expenseNumber) {
        const existing = await prisma.expense.findUnique({ where: { expenseNumber }});
        if (existing) {
            res.status(400).json({ success: false, message: 'Expense Number must be unique' });
            return;
        }
    }

    // Auto-generate if empty
    const generateNumber = () => {
        const dateObj = new Date();
        return `EXP-${dateObj.getFullYear().toString().substring(2)}${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    }

    const finalExpenseNumber = expenseNumber || generateNumber();

    const expense = await prisma.expense.create({
      data: {
        projectId,
        expenseNumber: finalExpenseNumber,
        date: date ? new Date(date) : new Date(),
        description,
        amount: Number(amount),
        category,
        receipt,
        cashFlow: {
          create: {
            date: date ? new Date(date) : new Date(),
            type: 'EXPENSE',
            amount: Number(amount),
            description: `Expense: ${finalExpenseNumber} - ${description}`,
            category: category || '5210 - Beban Lain-lain',
          }
        }
      },
    });

    res.status(201).json({ success: true, data: expense });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Expense
export const updateExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const { expenseNumber, date, description, amount, category, receipt } = req.body;

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        expenseNumber,
        date: date ? new Date(date) : undefined,
        description,
        amount: Number(amount),
        category,
        receipt,
      },
    });

    res.json({ success: true, data: expense });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Expense
export const deleteExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };

    await prisma.expense.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
