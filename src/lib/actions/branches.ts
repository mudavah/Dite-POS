'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { branchSchema } from '@/lib/validators';
import { auth } from '@/app/api/auth/[...nextauth]/route';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function getBranches() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });
}

export async function createBranch(data: unknown) {
  await requireAdmin();
  const validated = branchSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.flatten() };
  }

  const branch = await prisma.branch.create({
    data: validated.data,
  });

  await prisma.branchSetting.create({
    data: { branchId: branch.id },
  });

  revalidatePath('/branches');
  return { data: branch };
}

export async function updateBranch(id: string, data: unknown) {
  await requireAdmin();
  const validated = branchSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.flatten() };
  }

  const branch = await prisma.branch.update({
    where: { id },
    data: validated.data,
  });

  revalidatePath('/branches');
  return { data: branch };
}

export async function transferStock(data: { fromBranchId: string; toBranchId: string; productId: string; quantity: number; notes?: string }) {
  const session = await requireAdmin();

  const fromInventory = await prisma.inventory.findFirst({
    where: { branchId: data.fromBranchId, productId: data.productId },
  });

  if (!fromInventory || fromInventory.quantity < data.quantity) {
    return { error: 'Insufficient stock in source branch' };
  }

  const toInventory = await prisma.inventory.findFirst({
    where: { branchId: data.toBranchId, productId: data.productId },
  });

  if (toInventory) {
    await prisma.inventory.update({
      where: { id: toInventory.id },
      data: { quantity: { increment: data.quantity } },
    });
  } else {
    await prisma.inventory.create({
      data: { branchId: data.toBranchId, productId: data.productId, quantity: data.quantity },
    });
  }

  await prisma.inventory.update({
    where: { id: fromInventory.id },
    data: { quantity: { decrement: data.quantity } },
  });

  await prisma.stockMovement.create({
    data: {
      inventoryId: fromInventory.id,
      type: 'TRANSFER_OUT',
      quantity: -data.quantity,
      reference: `Transfer to ${data.toBranchId}`,
      notes: data.notes,
      createdById: session.user!.id,
    },
  });

  revalidatePath('/inventory');
  revalidatePath('/branches');
  return { success: true };
}
