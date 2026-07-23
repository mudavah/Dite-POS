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

  if (data.quantity <= 0) {
    return { error: 'Quantity must be greater than zero' };
  }

  await prisma.$transaction(async (tx) => {
    const fromInventory = await tx.inventory.findFirst({
      where: { branchId: data.fromBranchId, productId: data.productId },
    });

    if (!fromInventory || fromInventory.quantity < data.quantity) {
      throw new Error('Insufficient stock in source branch');
    }

    const toInventory = await tx.inventory.findFirst({
      where: { branchId: data.toBranchId, productId: data.productId },
    });

    if (toInventory) {
      await tx.inventory.update({
        where: { id: toInventory.id },
        data: { quantity: { increment: data.quantity } },
      });
    } else {
      await tx.inventory.create({
        data: { branchId: data.toBranchId, productId: data.productId, quantity: data.quantity },
      });
    }

    await tx.inventory.update({
      where: { id: fromInventory.id },
      data: { quantity: { decrement: data.quantity } },
    });

    const transfer = await tx.stockTransfer.create({
      data: {
        fromBranchId: data.fromBranchId,
        toBranchId: data.toBranchId,
        productId: data.productId,
        quantity: data.quantity,
        notes: data.notes,
        status: 'COMPLETED',
        createdById: session.user!.id,
      },
    });

    await tx.stockMovement.create({
      data: {
        inventoryId: fromInventory.id,
        type: 'TRANSFER_OUT',
        quantity: -data.quantity,
        reference: transfer.id,
        notes: data.notes,
        createdById: session.user!.id,
      },
    });

    if (toInventory) {
      await tx.stockMovement.create({
        data: {
          inventoryId: toInventory.id,
          type: 'TRANSFER_IN',
          quantity: data.quantity,
          reference: transfer.id,
          notes: data.notes,
          createdById: session.user!.id,
        },
      });
    }
  });

  revalidatePath('/inventory');
  revalidatePath('/branches');
  return { success: true };
}
