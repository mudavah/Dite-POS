import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { toNumeric } from '@/lib/numeric';
import type { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get('branchId') || session.user.branchId || '';
  const cashierId = searchParams.get('cashierId');

  const where: Prisma.SaleWhereInput = { paymentStatus: 'PENDING' };
  if (branchId) where.branchId = branchId;
  if (cashierId && session.user.role === 'ADMIN') where.cashierId = cashierId;

  const pendingSales = await prisma.sale.findMany({
    where,
    include: {
      cashier: { select: { id: true, name: true, email: true } },
      branch: { select: { id: true, name: true, code: true } },
      items: { include: { product: { select: { name: true, sku: true, price: true } } } },
      receipts: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(
    pendingSales.map((sale) => ({
      id: sale.id,
      branchId: sale.branchId,
      cashierId: sale.cashierId,
      cashier: sale.cashier,
      branch: sale.branch,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      customerPin: sale.customerPin,
      customerTin: sale.customerTin,
      subtotal: toNumeric(sale.subtotal),
      discountAmount: toNumeric(sale.discountAmount),
      totalAmount: toNumeric(sale.totalAmount),
      amountPaid: toNumeric(sale.amountPaid),
      changeAmount: toNumeric(sale.changeAmount),
      paymentMethod: sale.paymentMethod,
      notes: sale.notes,
      createdAt: sale.createdAt.toISOString(),
      items: sale.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: toNumeric(item.unitPrice),
        discount: toNumeric(item.discount),
        total: toNumeric(item.total),
        notes: item.notes,
        product: item.product,
      })),
      receipts: sale.receipts,
    }))
  );
}
