import prisma from '../prisma';

export const logActivity = async (data: {
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  userId?: string;
  userName?: string;
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        details: data.details,
        userId: data.userId,
        userName: data.userName,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};
