'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function adjustStock(data: { inventoryId: string; quantity: number; type: string; notes?: string }) {
  const inventory = await prisma.inventory.findUnique({
    where: { id: data.inventoryId },
  });

  if (!inventory) {
    return { error: 'Inventory not found' };
  }

  await prisma.stockMovement.create({
    data: {
      inventoryId: data.inventoryId,
      type: data.type as any,
      quantity: data.quantity,
      notes: data.notes,
      createdById: 'system',
    },
  });

  await prisma.inventory.update({
    where: { id: data.inventoryId },
    data: { quantity: { increment: data.quantity } },
  });

  revalidatePath('/inventory');
  return { success: true };
}

export async function getInventory(branchId?: string) {
  const where: any = {};
  if (branchId) where.branchId = branchId;

  const inventory = await prisma.inventory.findMany({
    where,
    include: {
      product: { select: { name: true, sku: true, price: true, isActive: true, lowStockThreshold: true, costPrice: true } },
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
      product: { ...inv.product, price: inv.product.price.toNumber(), costPrice: inv.product.costPrice?.toNumber() || null },
    })),
    branches,
  };
}
