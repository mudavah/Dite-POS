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
      branch: {
        select: {
          name: true,
          address: true,
          phone: true,
          settings: {
            select: {
              shopName: true,
              currency: true,
              currencySymbol: true,
              footerText: true,
            },
          },
        },
      },
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
    branch: sale.branch,
    shopName: sale.branch?.settings?.shopName || 'Dite POS',
    branchName: sale.branch?.name,
    branchAddress: sale.branch?.address,
    branchPhone: sale.branch?.phone,
    currency: sale.branch?.settings?.currency || 'KES',
    currencySymbol: sale.branch?.settings?.currencySymbol || 'KSh',
    footerText: sale.branch?.settings?.footerText,
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
