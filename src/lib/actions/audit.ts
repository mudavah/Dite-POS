'use server';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function auditLog(data: {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValues?: string;
  newValues?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId || null,
        oldValues: data.oldValues || null,
        newValues: data.newValues || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });
  } catch (error) {
    logger.error('Failed to create audit log', error);
  }
}