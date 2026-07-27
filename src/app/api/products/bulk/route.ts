import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auditLog } from '@/lib/actions/audit';
import { StockMovementType } from '@prisma/client';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action, productIds, data } = body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return NextResponse.json({ error: 'No product IDs provided' }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (action === 'archive') {
      await tx.product.updateMany({
        where: { id: { in: productIds } },
        data: { isArchived: true, isActive: false },
      });
    } else if (action === 'unarchive') {
      await tx.product.updateMany({
        where: { id: { in: productIds } },
        data: { isArchived: false, isActive: true },
      });
    } else if (action === 'delete') {
      await tx.product.deleteMany({
        where: { id: { in: productIds } },
      });
    } else if (action === 'update') {
      await tx.product.updateMany({
        where: { id: { in: productIds } },
        data,
      });
    } else if (action === 'setStatus') {
      await tx.product.updateMany({
        where: { id: { in: productIds } },
        data: { isActive: data.isActive },
      });
    }

    for (const productId of productIds) {
      await auditLog({
        userId: session.user.id,
        action: `PRODUCT_${action.toUpperCase()}`,
        entity: 'Product',
        entityId: productId,
        newValues: JSON.stringify({ action, productId }),
      });
    }
  });

  revalidatePath('/products');
  revalidatePath('/inventory');
  revalidatePath('/dashboard');

  return NextResponse.json({ success: true });
}
