import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { fromBranchId, toBranchId, productId, quantity, notes } = body;

  if (!fromBranchId || !toBranchId || !productId || !quantity) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const fromInventory = await prisma.inventory.findFirst({
    where: { branchId: fromBranchId, productId },
  });

  if (!fromInventory || fromInventory.quantity < quantity) {
    return NextResponse.json({ error: 'Insufficient stock in source branch' }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          fromBranchId,
          toBranchId,
          productId,
          quantity,
          notes,
          status: 'COMPLETED',
          createdById: session.user.id,
        },
      });

      await tx.inventory.updateMany({
        where: { id: fromInventory.id, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });

      const toInventory = await tx.inventory.findFirst({
        where: { branchId: toBranchId, productId },
      });

      if (toInventory) {
        await tx.inventory.update({
          where: { id: toInventory.id },
          data: { quantity: { increment: quantity } },
        });
      } else {
        await tx.inventory.create({
          data: { branchId: toBranchId, productId, quantity },
        });
      }

      await tx.stockMovement.create({
        data: {
          inventoryId: fromInventory.id,
          type: 'TRANSFER_OUT',
          quantity: -quantity,
          reference: transfer.id,
          notes: `Transfer to branch ${toBranchId}`,
          createdById: session.user.id,
        },
      });

      if (toInventory) {
        await tx.stockMovement.create({
          data: {
            inventoryId: toInventory.id,
            type: 'TRANSFER_IN',
            quantity,
            reference: transfer.id,
            notes: `Transfer from branch ${fromBranchId}`,
            createdById: session.user.id,
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transfer failed' },
      { status: 400 }
    );
  }
}
