import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


import { toNumeric } from '@/lib/numeric';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
           email: true,
           settings: {
             select: {
               shopName: true,
               currency: true,
               currencySymbol: true,
               footerText: true,
               kraPin: true,
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
    subtotal: toNumeric(sale.subtotal),
    discountAmount: toNumeric(sale.discountAmount),
    totalAmount: toNumeric(sale.totalAmount),
    paymentMethod: sale.paymentMethod,
    amountPaid: toNumeric(sale.amountPaid),
    changeAmount: toNumeric(sale.changeAmount),
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerPin: sale.customerPin,
    customerTin: sale.customerTin,
    cashier: sale.cashier,
    branch: sale.branch,
    shopName: sale.branch?.settings?.shopName || 'Dite POS',
    branchName: sale.branch?.name,
    branchAddress: sale.branch?.address,
    branchPhone: sale.branch?.phone,
    branchEmail: sale.branch?.email,
    kraPin: sale.branch?.settings?.kraPin,
    currency: sale.branch?.settings?.currency || 'KES',
    currencySymbol: sale.branch?.settings?.currencySymbol || 'KSh',
    footerText: sale.branch?.settings?.footerText,
    items: sale.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: toNumeric(i.unitPrice),
      discount: toNumeric(i.discount),
      total: toNumeric(i.total),
      notes: i.notes,
    })),
  });
}
