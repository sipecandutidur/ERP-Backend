import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    roleId: string;
    roleName: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true },
    });

    if (!user) {
      res.status(401).json({ status: 'error', message: 'User not found' });
      return;
    }

    req.user = {
      id: user.id,
      roleId: user.roleId,
      roleName: user.role.name,
    };

    next();
  } catch (error) {
    res.status(401).json({ status: 'error', message: 'Invalid token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.roleName)) {
      res.status(403).json({ status: 'error', message: 'Forbidden: Insufficient permissions' });
      return;
    }
    next();
  };
};
