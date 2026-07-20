import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'sales';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const where: any = {};
  if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
  if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

  let data: any = null;

  if (type === 'sales') {
    data = await prisma.sale.findMany({
      where: { ...where, paymentStatus: 'COMPLETED' },
      include: { cashier: true, branch: true, items: { include: { product: true } } },
    });
  } else if (type === 'products') {
    data = await prisma.product.findMany({
      where: { isArchived: false },
      include: { category: true, inventories: true },
    });
  } else if (type === 'inventory') {
    data = await prisma.inventory.findMany({
      where,
      include: { product: true, branch: true },
    });
  } else if (type === 'profit') {
    data = await prisma.sale.findMany({
      where: { ...where, paymentStatus: 'COMPLETED' },
      include: { cashier: true, branch: true, items: { include: { product: { select: { costPrice: true } } } } },
    });
  } else if (type === 'cashiers') {
    data = await prisma.user.findMany({
      where: { role: 'CASHIER', isActive: true },
      include: { sales: { where: { ...where, paymentStatus: 'COMPLETED' } } },
    });
  } else if (type === 'branches') {
    data = await prisma.branch.findMany({
      where: { isActive: true },
      include: { sales: { where: { ...where, paymentStatus: 'COMPLETED' } } },
    });
  }

  return NextResponse.json({ type, data });
}
