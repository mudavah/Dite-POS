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
  } else if (type === 'category-sales') {
    const sales = await prisma.sale.findMany({
      where: { ...where, paymentStatus: 'COMPLETED' },
      include: {
        branch: { select: { name: true, code: true } },
        items: {
          include: {
            product: {
              include: {
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const categoryMap: Record<string, { category: string; cash: number; card: number; bankTransfer: number; mobileMoney: number; total: number }> = {};

    for (const sale of sales) {
      for (const item of sale.items) {
        const categoryName = item.product.category?.name || 'Uncategorized';
        if (!categoryMap[categoryName]) {
          categoryMap[categoryName] = { category: categoryName, cash: 0, card: 0, bankTransfer: 0, mobileMoney: 0, total: 0 };
        }
        const method = sale.paymentMethod;
        const amount = item.total.toNumber();
        if (method === 'CASH') categoryMap[categoryName].cash += amount;
        else if (method === 'CARD') categoryMap[categoryName].card += amount;
        else if (method === 'BANK_TRANSFER') categoryMap[categoryName].bankTransfer += amount;
        else if (method === 'MOBILE_MONEY') categoryMap[categoryName].mobileMoney += amount;
        categoryMap[categoryName].total += amount;
      }
    }

    data = Object.values(categoryMap);
  }

  return NextResponse.json({ type, data });
}
