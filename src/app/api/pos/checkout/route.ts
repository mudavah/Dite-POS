import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { saleSchema } from '@/lib/validators';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const validated = saleSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json({ error: validated.error.flatten() }, { status: 400 });
  }

  const branchId = session.user.branchId as string;
  const cashierId = session.user.id;

  const sale = await prisma.sale.create({
    data: {
      branchId,
      cashierId,
      customerName: validated.data.customerName,
      customerPhone: validated.data.customerPhone,
      subtotal: validated.data.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
      discountAmount: validated.data.items.reduce((sum, item) => sum + item.discount, 0),
      totalAmount: 0,
      paymentMethod: validated.data.paymentMethod,
      amountPaid: validated.data.amountPaid,
      changeAmount: validated.data.amountPaid,
      notes: validated.data.notes,
      items: {
        create: validated.data.items.map((item) => ({
          productId: item.productId,
          product: { connect: { id: item.productId } },
          productName: item.productName || item.sku || '',
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          total: item.unitPrice * item.quantity,
          notes: item.notes,
        })),
      },
    },
    include: { items: true },
  });

  const totalAmount = (sale as any).items.reduce((sum: number, item: any) => sum + item.total.toNumber(), 0) - sale.discountAmount.toNumber();

  await prisma.sale.update({
    where: { id: sale.id },
    data: { totalAmount },
  });

  const settings = await prisma.branchSetting.findUnique({ where: { branchId } });
  const receiptNo = `${settings?.receiptPrefix || 'RCP'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(settings?.receiptNextNum || 1).padStart(5, '0')}`;

  await prisma.receipt.create({
    data: {
      saleId: sale.id,
      receiptNo,
      branchId,
    },
  });

  await prisma.branchSetting.update({
    where: { branchId },
    data: { receiptNextNum: { increment: 1 } },
  });

  return NextResponse.json({
    id: sale.id,
    receiptNo,
    totalAmount,
  });
}
