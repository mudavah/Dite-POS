import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { PaymentMethod } from '@prisma/client';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bodyText = await request.text();
  const body = JSON.parse(bodyText) as {
    paymentMethod?: string;
    amountPaid?: number;
    changeAmount?: number;
  };
  const { paymentMethod, amountPaid, changeAmount } = body;

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { items: true, branch: true },
  });

  if (!sale) {
    return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
  }

  if (sale.paymentStatus === 'COMPLETED') {
    return NextResponse.json({ error: 'Sale is already completed' }, { status: 400 });
  }

  const totalAmount = sale.items.reduce((sum, item) => sum + item.total.toNumber(), 0) - sale.discountAmount.toNumber();
  const cashierId = session.user.id;

  try {
    const updatedSale = await prisma.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id },
        data: {
          paymentStatus: 'COMPLETED',
          paymentMethod: ((paymentMethod || sale.paymentMethod) as PaymentMethod),
          amountPaid: amountPaid ?? sale.amountPaid,
          changeAmount: changeAmount ?? sale.changeAmount,
          totalAmount,
        },
        include: { items: true, cashier: { select: { name: true, email: true } }, branch: { select: { name: true, code: true } }, receipts: { select: { receiptNo: true } } },
      });

      const updatedItems = (updated as unknown as { items: Array<{ productId: string; productName: string; sku?: string; quantity: number; unitPrice: number; discount: number; total: number; notes?: string }> }).items;
      for (const item of updatedItems) {
        const inventory = await tx.inventory.findFirst({
          where: { branchId: sale.branchId, productId: item.productId },
        });

        if (inventory) {
          const stockUpdated = await tx.inventory.updateMany({
            where: { id: inventory.id, quantity: { gte: item.quantity } },
            data: { quantity: { decrement: item.quantity } },
          });

          if (stockUpdated.count === 0) {
            throw new Error(`Insufficient stock for ${item.productName || item.sku}`);
          }

          await tx.stockMovement.create({
            data: {
              inventoryId: inventory.id,
              type: 'SALE',
              quantity: -item.quantity,
              reference: sale.id,
              notes: 'Pending sale completed',
              createdById: cashierId,
            },
          });
        }
      }

      const settings = await tx.branchSetting.findUnique({ where: { branchId: sale.branchId } });
      if (!settings) {
        throw new Error('Branch settings not found');
      }

      const updatedSettings = await tx.branchSetting.update({
        where: { branchId: sale.branchId },
        data: { receiptNextNum: { increment: 1 } },
      });
      const nextNum = updatedSettings.receiptNextNum;
      const receiptNo = `${settings.receiptPrefix || 'RCP'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(nextNum).padStart(5, '0')}`;

      await tx.receipt.upsert({
        where: { saleId: sale.id },
        update: { receiptNo, printedAt: new Date() },
        create: { saleId: sale.id, receiptNo, branchId: sale.branchId },
      });

      return updated;
    });

    return NextResponse.json({
      id: updatedSale.id,
      receiptNo: (updatedSale as unknown as { receipts: Array<{ receiptId: string; receiptNo: string }> }).receipts?.[0]?.receiptNo,
      totalAmount: updatedSale.totalAmount.toNumber(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete pending sale' },
      { status: 400 }
    );
  }
}
