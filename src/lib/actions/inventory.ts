'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { StockMovementType } from '@prisma/client';
import { logger } from '@/lib/logger';
import { auditLog } from '@/lib/actions/audit';
import { toNumeric } from '@/lib/numeric';

async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function adjustStock(data: { inventoryId: string; quantity: number; type: StockMovementType; notes?: string }) {
  const session = await requireAuth();

  const inventory = await prisma.inventory.findUnique({
    where: { id: data.inventoryId },
  });

  if (!inventory) {
    return { error: 'Inventory not found' };
  }

  const createdById = session.user.id;

  const newQuantity = inventory.quantity + data.quantity;
  if (newQuantity < 0) {
    return { error: 'Insufficient stock for this adjustment' };
  }

  try {
    await prisma.stockMovement.create({
      data: {
        inventoryId: data.inventoryId,
        type: data.type,
        quantity: data.quantity,
        notes: data.notes,
        createdById,
      },
    });

    await prisma.inventory.update({
      where: { id: data.inventoryId },
      data: { quantity: newQuantity },
    });

    await auditLog({
      userId: createdById,
      action: 'STOCK_ADJUSTMENT',
      entity: 'Inventory',
      entityId: data.inventoryId,
      newValues: JSON.stringify({ type: data.type, quantity: data.quantity, inventoryId: data.inventoryId }),
    });

    revalidatePath('/inventory');
    return { success: true };
  } catch (error) {
    logger.error('Failed to adjust stock', error);
    return { error: 'Failed to adjust stock' };
  }
}

export async function getInventory(branchId?: string) {
  await requireAuth();
  const where: Record<string, unknown> = {};
  if (branchId) where.branchId = branchId;

  const inventory = await prisma.inventory.findMany({
    where,
    include: {
      product: { select: { name: true, sku: true, price: true, isActive: true, lowStockThreshold: true, costPrice: true, taxRate: true, discount: true } },
      branch: { select: { name: true, code: true } },
      movements: { take: 5, orderBy: { createdAt: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
  });

  return {
    inventory: inventory.map((inv) => ({
      ...inv,
      product: {
        ...inv.product,
        price: toNumeric(inv.product.price),
        costPrice: toNumeric(inv.product.costPrice) || null,
        taxRate: toNumeric(inv.product.taxRate),
        discount: toNumeric(inv.product.discount),
      },
    })),
    branches,
  };
}
