import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { formatCurrency } from '@/lib/utils';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cashierId = session.user.id as string;
  const branchId = session.user.branchId as string;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const sales = await prisma.sale.findMany({
    where: {
      cashierId,
      branchId,
      createdAt: { gte: startOfDay },
      paymentStatus: 'COMPLETED',
    },
    include: {
      items: true,
      payments: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalSales = sales.reduce((sum, s) => sum + s.totalAmount.toNumber(), 0);
  const totalCash = sales.filter((s) => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.totalAmount.toNumber(), 0);
  const totalCard = sales.filter((s) => s.paymentMethod === 'CARD').reduce((sum, s) => sum + s.totalAmount.toNumber(), 0);
  const totalMobile = sales.filter((s) => s.paymentMethod === 'MOBILE_MONEY').reduce((sum, s) => sum + s.totalAmount.toNumber(), 0);
  const totalTransfer = sales.filter((s) => s.paymentMethod === 'BANK_TRANSFER').reduce((sum, s) => sum + s.totalAmount.toNumber(), 0);
  const totalSplit = sales.filter((s) => s.paymentMethod === 'SPLIT').reduce((sum, s) => sum + s.totalAmount.toNumber(), 0);

  return NextResponse.json({
    sales: sales.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      totalAmount: s.totalAmount.toNumber(),
      paymentMethod: s.paymentMethod,
      paymentStatus: s.paymentStatus,
      customerName: s.customerName,
      items: s.items.map((i) => ({
        name: i.productName,
        quantity: i.quantity,
        total: i.total.toNumber(),
      })),
    })),
    summary: {
      count: sales.length,
      totalSales,
      totalCash,
      totalCard,
      totalMobile,
      totalTransfer,
      totalSplit,
    },
  });
}
