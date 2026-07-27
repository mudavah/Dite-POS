import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/actions/audit';
import { revalidatePath } from 'next/cache';
import { StockMovementType } from '@prisma/client';
import { sanitizeText } from '@/lib/utils';

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
    include: { items: true, supplier: true },
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
      let product = null;

      if (item.productId) {
        product = await tx.product.findUnique({ where: { id: item.productId } });
      } else if (item.sku) {
        product = await tx.product.findUnique({ where: { sku: item.sku } });
      } else if (item.barcode) {
        product = await tx.product.findUnique({ where: { barcode: item.barcode } });
      }

      if (!product && item.productName) {
        const sku = item.sku || `AUTO-${Date.now()}-${item.productName.replace(/\s+/g, '-').slice(0, 20)}`;
        product = await tx.product.create({
          data: {
            name: sanitizeText(item.productName) || item.productName,
            sku,
            barcode: item.barcode || undefined,
            description: item.notes || undefined,
            price: item.sellingPrice,
            costPrice: item.buyingPrice,
            lowStockThreshold: 10,
            maxStock: 1000,
            taxRate: item.tax || 0,
            discount: item.discount || 0,
            unit: 'pcs',
            reorderLevel: 10,
            isActive: true,
          },
        });
      }

      let inventory = await tx.inventory.findUnique({
        where: { branchId_productId: { branchId: purchase.branchId, productId: product!.id } },
      });

      if (!inventory) {
        inventory = await tx.inventory.create({
          data: {
            branchId: purchase.branchId,
            productId: product!.id,
            quantity: item.quantity,
          },
        });
      } else {
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: { increment: item.quantity } },
        });
      }

      const oldStock = inventory.quantity - item.quantity;

      await tx.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          type: StockMovementType.PURCHASE,
          quantity: item.quantity,
          reference: purchase.purchaseNumber,
          notes: `Purchase ${purchase.purchaseNumber} - ${item.productName}`,
          createdById: session.user!.id,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryId: inventory.id,
          productId: product!.id,
          branchId: purchase.branchId,
          type: StockMovementType.PURCHASE,
          quantity: item.quantity,
          previousStock: oldStock,
          newStock: inventory.quantity,
          referenceNumber: purchase.purchaseNumber,
          notes: `Purchase ${purchase.purchaseNumber}`,
          createdById: session.user!.id,
        },
      });

      if (product) {
        await tx.product.update({
          where: { id: product.id },
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
      newValues: JSON.stringify({ status: 'RECEIVED', receivedAt: new Date(), itemCount: purchase.items.length }),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    return updatedPurchase;
  });

  revalidatePath('/purchases');
  revalidatePath('/inventory');
  revalidatePath('/dashboard');
  revalidatePath('/products');

  return NextResponse.json({ success: true, purchase: result });
}