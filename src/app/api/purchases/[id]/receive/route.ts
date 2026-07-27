import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/actions/audit';
import { revalidatePath } from 'next/cache';
import { StockMovementType } from '@prisma/client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!purchase) {
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
  }

  if (purchase.status === 'RECEIVED') {
    return NextResponse.json({ error: 'Purchase already received' }, { status: 400 });
  }

  if (purchase.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Cannot receive a cancelled purchase' }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedPurchase = await tx.purchase.update({
      where: { id },
      data: {
        status: 'RECEIVED',
        receivedAt: new Date(),
        outstandingBalance: {
          decrement: (purchase.amountPaid as any) || 0,
        },
      },
    });

    for (const item of purchase.items) {
      let inventory = await tx.inventory.findUnique({
        where: { branchId_productId: { branchId: purchase.branchId, productId: item.productId! } },
      });

      if (!inventory) {
        inventory = await tx.inventory.create({
          data: {
            branchId: purchase.branchId,
            productId: item.productId!,
            quantity: item.quantity,
          },
        });
      } else {
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: { increment: item.quantity } },
        });
      }

      await tx.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          type: StockMovementType.PURCHASE,
          quantity: item.quantity,
          reference: purchase.purchaseNumber,
          notes: `Purchase ${purchase.purchaseNumber}`,
          createdById: session.user!.id,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryId: inventory.id,
          productId: item.productId!,
          branchId: purchase.branchId,
          type: StockMovementType.PURCHASE,
          quantity: item.quantity,
          previousStock: inventory.quantity,
          newStock: inventory.quantity + item.quantity,
          referenceNumber: purchase.purchaseNumber,
          notes: `Purchase ${purchase.purchaseNumber}`,
          createdById: session.user!.id,
        },
      });

      if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            costPrice: item.buyingPrice,
            price: item.sellingPrice,
          },
        });
      }
    }

    await auditLog({
      userId: session.user!.id,
      action: 'PURCHASE_RECEIVED',
      entity: 'Purchase',
      entityId: id,
      newValues: JSON.stringify({ status: 'RECEIVED', receivedAt: new Date() }),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    return updatedPurchase;
  });

  revalidatePath('/purchases');
  revalidatePath('/inventory');
  revalidatePath('/dashboard');

  return NextResponse.json({ success: true, purchase: result });
}