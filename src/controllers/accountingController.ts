import { Request, Response } from 'express';
import prisma from '../prisma';

export const getFinancialSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    // Total Revenue (Paid + Partial from AmountPaid)
    const invoices = await prisma.invoice.findMany({
      select: {
        total: true,
        amountPaid: true,
        status: true,
      }
    });

    let totalRevenue = 0;
    let totalReceivables = 0; // Unpaid amounts

    invoices.forEach((inv: any) => {
      totalRevenue += inv.amountPaid;
      totalReceivables += (inv.total - inv.amountPaid);
    });

    // Total expenses should be calculated from confirmed Purchase Orders.
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { status: { in: ['CONFIRMED', 'COMPLETED', 'DELIVERED', 'RECEIVED'] } }, // Include typical active/completed statuses
      select: { total: true }
    });

    let totalExpenses = 0;
    purchaseOrders.forEach((po: any) => {
      totalExpenses += po.total;
    });

    const netProfit = totalRevenue - totalExpenses;

    const summary = {
      totalRevenue,
      totalReceivables,
      totalExpenses,
      netProfit,
    };

    res.status(200).json({ status: 'success', data: { summary } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to generate financial summary' });
  }
};

export const getTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query;

    let dateFilter: any = {};
    if (month && year && month !== 'ALL' && year !== 'ALL') {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
      dateFilter = {
        date: {
          gte: startDate,
          lte: endDate,
        }
      };
    } else if (year && year !== 'ALL') {
      const startDate = new Date(Number(year), 0, 1);
      const endDate = new Date(Number(year), 11, 31, 23, 59, 59, 999);
      dateFilter = {
        date: {
          gte: startDate,
          lte: endDate,
        }
      };
    }

    const transactions = await prisma.cashFlowTransaction.findMany({
      where: dateFilter,
      orderBy: { date: 'desc' },
      include: {
        expense: { select: { expenseNumber: true } },
        payment: { select: { paymentNumber: true, invoice: { select: { invoiceNumber: true } } } }
      }
    });

    const income = await prisma.cashFlowTransaction.aggregate({
      where: { type: 'INCOME', ...dateFilter },
      _sum: { amount: true }
    });

    const expense = await prisma.cashFlowTransaction.aggregate({
      where: { type: 'EXPENSE', ...dateFilter },
      _sum: { amount: true }
    });

    const totalIncome = income._sum.amount || 0;
    const totalExpense = expense._sum.amount || 0;
    const balance = totalIncome - totalExpense;

    res.status(200).json({
      status: 'success',
      data: {
        transactions,
        summary: { totalIncome, totalExpense, balance }
      }
    });
  } catch (error) {
    console.error("Fetch transactions error:", error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch transactions' });
  }
};

export const createTransaction = async (req: Request, res: Response): Promise<void> => {
  const { date, type, amount, description, category } = req.body;

  if (!type || !amount || !description) {
    res.status(400).json({ status: 'error', message: 'Missing required fields' });
    return;
  }

  try {
    const transaction = await prisma.cashFlowTransaction.create({
      data: {
        date: date ? new Date(date) : new Date(),
        type,
        amount,
        description,
        category,
      }
    });

    res.status(201).json({ status: 'success', data: { transaction } });
  } catch (error) {
    console.error("Create manual transaction error:", error);
    res.status(500).json({ status: 'error', message: 'Failed to record transaction' });
  }
};
