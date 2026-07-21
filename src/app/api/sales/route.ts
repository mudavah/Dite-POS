import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { saleSchema } from '@/lib/validators';
import { compare } from 'bcryptjs';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const branchId = searchParams.get('branchId');
  const cashierId = searchParams.get('cashierId');

  const where: any = session.user.role === 'ADMIN' ? {} : { branchId: session.user.branchId };
  if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
  if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
  if (branchId && session.user.role === 'ADMIN') where.branchId = branchId;
  if (cashierId && session.user.role === 'ADMIN') where.cashierId = cashierId;

  const sales = await prisma.sale.findMany({
    where,
    include: { cashier: true, branch: true, items: { include: { product: true } }, payments: true, receipts: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(
    sales.map((sale) => ({
      ...sale,
      subtotal: sale.subtotal.toNumber(),
      discountAmount: sale.discountAmount.toNumber(),
      totalAmount: sale.totalAmount.toNumber(),
      amountPaid: sale.amountPaid.toNumber(),
      changeAmount: sale.changeAmount.toNumber(),
    }))
  );
}

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

  const subtotal = validated.data.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountAmount = validated.data.items.reduce((sum, item) => sum + (item.discount || 0), 0);
  const totalAmount = subtotal - discountAmount;

  const sale = await prisma.sale.create({
    data: {
      branchId,
      cashierId,
      customerId: validated.data.customerId,
      customerName: validated.data.customerName,
      customerPhone: validated.data.customerPhone,
      subtotal,
      discountAmount,
      totalAmount,
      paymentMethod: validated.data.paymentMethod,
      amountPaid: validated.data.amountPaid,
      changeAmount: Math.max(0, validated.data.amountPaid - totalAmount),
      paymentStatus: 'COMPLETED',
      notes: validated.data.notes,
      items: {
        create: validated.data.items.map((item) => ({
          productId: item.productId,
          productName: item.productName || item.sku || 'Unknown',
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          total: (item.unitPrice * item.quantity) - (item.discount || 0),
          notes: item.notes,
        })),
      },
    },
    include: { items: true },
  });

  for (const item of validated.data.items) {
    const inventory = await prisma.inventory.findFirst({
      where: { branchId, productId: item.productId },
    });

    if (inventory) {
      await prisma.inventory.update({
        where: { id: inventory.id },
        data: { quantity: { decrement: item.quantity } },
      });

      await prisma.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          type: 'SALE',
          quantity: -item.quantity,
          reference: sale.id,
          notes: `Sale ${sale.id}`,
          createdById: cashierId,
        },
      });
    }
  }

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
