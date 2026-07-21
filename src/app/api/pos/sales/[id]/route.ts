import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      items: true,
      cashier: { select: { name: true } },
      receipts: true,
    },
  });

  if (!sale) {
    return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: sale.id,
    receiptNo: sale.receipts?.[0]?.receiptNo,
    createdAt: sale.createdAt.toISOString(),
    subtotal: sale.subtotal.toNumber(),
    discountAmount: sale.discountAmount.toNumber(),
    totalAmount: sale.totalAmount.toNumber(),
    paymentMethod: sale.paymentMethod,
    amountPaid: sale.amountPaid.toNumber(),
    changeAmount: sale.changeAmount.toNumber(),
    customerName: sale.customerName,
    cashier: sale.cashier,
    items: sale.items.map((i: any) => ({
      productId: i.productId,
      productName: i.productName,
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: i.unitPrice.toNumber(),
      discount: i.discount.toNumber(),
      total: i.total.toNumber(),
      notes: i.notes,
    })),
  });
}
