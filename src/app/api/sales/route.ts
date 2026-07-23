import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createSale } from '@/lib/actions/sales';
import { saleSchema } from '@/lib/validators';

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

  const where: Record<string, unknown> = session.user.role === 'ADMIN' ? {} : { branchId: session.user.branchId };
  if (startDate) where.createdAt = { ...(where.createdAt as Record<string, unknown> | undefined), gte: new Date(startDate) };
  if (endDate) where.createdAt = { ...(where.createdAt as Record<string, unknown> | undefined), lte: new Date(endDate) };
  if (branchId && session.user.role === 'ADMIN') where.branchId = branchId;
  if (cashierId && session.user.role === 'ADMIN') where.cashierId = cashierId;

  const sales = await prisma.sale.findMany({
    where,
    include: { cashier: { select: { name: true, email: true } }, branch: { select: { name: true, code: true } }, items: { include: { product: { select: { name: true, sku: true } } } }, payments: { select: { method: true, amount: true } }, receipts: { select: { receiptNo: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(
    sales.map((sale) => ({
      ...sale,
      cashier: sale.cashier ? { name: sale.cashier.name, email: sale.cashier.email } : null,
      branch: sale.branch ? { name: sale.branch.name, code: sale.branch.code } : null,
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

  try {
    const { sale, receiptNo } = await createSale(
      { ...validated.data, branchId, cashierId },
      undefined
    );

    return NextResponse.json({
      id: sale.id,
      receiptNo,
      totalAmount: sale.totalAmount.toNumber(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sale creation failed' },
      { status: 400 }
    );
  }
}
