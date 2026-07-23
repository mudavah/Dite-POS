import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { sanitizeText } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ isOnline: true, syncStatus: 'complete', pendingCount: 0, conflictCount: 0, items: [] });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const item = body as {
      entityType?: string;
      entityId?: string;
      action?: string;
      payload?: string;
      status?: string;
    };

    if (item.entityType === 'sale' && item.payload) {
      const salePayload = JSON.parse(item.payload);
      const branchId = session.user.branchId as string;
      const cashierId = session.user.id;

      if (!branchId) {
        return NextResponse.json({ error: 'User is not assigned to a branch' }, { status: 400 });
      }

      const items = salePayload.items || [];
      const subtotal = items.reduce((sum: number, item: { unitPrice: number; quantity: number; discount?: number }) => sum + item.unitPrice * item.quantity, 0);
      const discountAmount = items.reduce((sum: number, item: { discount?: number }) => sum + (item.discount || 0), 0);
      const totalAmount = subtotal - discountAmount;

      const existingSale = await prisma.sale.findUnique({
        where: { id: salePayload.saleId || item.entityId },
      });

      if (existingSale) {
        return NextResponse.json({ success: true, message: 'Sale already synced' });
      }

      const sale = await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.create({
          data: {
            id: salePayload.saleId || item.entityId,
            branchId,
            cashierId,
            customerName: sanitizeText(salePayload.customerName),
            customerPhone: sanitizeText(salePayload.customerPhone),
            subtotal,
            discountAmount,
            totalAmount,
            paymentMethod: salePayload.paymentMethod,
            amountPaid: salePayload.amountPaid,
            changeAmount: salePayload.changeAmount || 0,
            paymentStatus: 'COMPLETED',
            notes: sanitizeText(salePayload.notes),
            items: {
              create: items.map((item: { productId: string; productName: string; sku?: string; quantity: number; unitPrice: number; discount?: number; notes?: string }) => ({
                productId: item.productId,
                productName: sanitizeText(item.productName) || item.sku || '',
                sku: item.sku,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount || 0,
                total: (item.unitPrice * item.quantity) - (item.discount || 0),
                notes: sanitizeText(item.notes),
              })),
            },
          },
          include: { items: true },
        });

        for (const item of items) {
          const inventory = await tx.inventory.findFirst({
            where: { branchId, productId: item.productId },
          });

          if (inventory) {
            const updated = await tx.inventory.updateMany({
              where: { id: inventory.id, quantity: { gte: item.quantity } },
              data: { quantity: { decrement: item.quantity } },
            });

            if (updated.count === 0) {
              throw new Error(`Insufficient stock for ${item.productName || item.sku}`);
            }

            await tx.stockMovement.create({
              data: {
                inventoryId: inventory.id,
                type: 'SALE',
                quantity: -item.quantity,
                reference: sale.id,
                notes: `Offline sale ${sale.id}`,
                createdById: cashierId,
              },
            });
          }
        }

        const settings = await tx.branchSetting.findUnique({ where: { branchId } });
        if (!settings) {
          throw new Error('Branch settings not found');
        }

        const updatedSettings = await tx.branchSetting.update({
          where: { branchId },
          data: { receiptNextNum: { increment: 1 } },
        });
        const receiptNo = `${settings.receiptPrefix || 'RCP'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(updatedSettings.receiptNextNum).padStart(5, '0')}`;

        await tx.receipt.create({
          data: {
            saleId: sale.id,
            receiptNo,
            branchId,
          },
        });

        return { sale, receiptNo };
      });

      return NextResponse.json({ success: true, saleId: sale.sale.id, receiptNo: sale.receiptNo });
    }

    return NextResponse.json({ success: true, message: 'Sync item processed' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
