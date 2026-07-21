'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/app/api/auth/[...nextauth]/route';

async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function adjustStock(data: { inventoryId: string; quantity: number; type: string; notes?: string }) {
  await requireAuth();

  const inventory = await prisma.inventory.findUnique({
    where: { id: data.inventoryId },
  });

  if (!inventory) {
    return { error: 'Inventory not found' };
  }

  const session = await auth();
  const createdById = session?.user?.id || 'system';

  await prisma.stockMovement.create({
    data: {
      inventoryId: data.inventoryId,
      type: data.type as any,
      quantity: data.quantity,
      notes: data.notes,
      createdById,
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
  await requireAuth();
  const where: Record<string, unknown> = {};
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
