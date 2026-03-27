import { Request, Response } from 'express';
import prisma from '../prisma';

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.status(200).json({ status: 'success', data: { logs } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch audit logs' });
  }
};
