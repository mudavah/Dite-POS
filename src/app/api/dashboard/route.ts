import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const isAdmin = session.user.role === 'ADMIN';
  const branchFilter = isAdmin ? {} : { branchId: session.user.branchId as string | undefined };

  const [
    todaySales,
    weekSales,
    monthSales,
    recentSales,
    topProducts,
    lowStock,
    branchPerformance,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { ...branchFilter, createdAt: { gte: today }, paymentStatus: 'COMPLETED' },
      _sum: { totalAmount: true, subtotal: true },
    }),
    prisma.sale.aggregate({
      where: { ...branchFilter, createdAt: { gte: weekStart }, paymentStatus: 'COMPLETED' },
      _sum: { totalAmount: true },
    }),
    prisma.sale.aggregate({
      where: { ...branchFilter, createdAt: { gte: monthStart }, paymentStatus: 'COMPLETED' },
      _sum: { totalAmount: true },
    }),
    prisma.sale.findMany({
      where: { ...branchFilter, createdAt: { gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000) } },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { cashier: { select: { name: true, email: true } }, branch: { select: { name: true, code: true } } },
    }),
    prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: { ...branchFilter, createdAt: { gte: monthStart }, paymentStatus: 'COMPLETED' },
      },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    }),
    prisma.inventory.findMany({
      where: { quantity: { lte: 10 }, product: { isArchived: false } },
      include: { product: true, branch: true },
      take: 10,
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { sales: true } },
        sales: {
          where: { createdAt: { gte: monthStart }, paymentStatus: 'COMPLETED' },
          select: { totalAmount: true },
        },
      },
    }),
  ]);

  const topProductsWithDetails = await Promise.all(
    topProducts.map(async (item) => {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true, sku: true, price: true },
      });
      return { ...item, product };
    })
  );

  const revenue = monthSales._sum?.totalAmount?.toNumber() || 0;
  const cost = await prisma.saleItem.aggregate({
    where: {
      sale: { ...branchFilter, createdAt: { gte: monthStart }, paymentStatus: 'COMPLETED' },
    },
    _sum: { total: true },
  });
  const totalCost = cost._sum?.total?.toNumber() || 0;
  const profit = revenue - totalCost;

  const branchesPerformance = branchPerformance.map((branch) => {
    const totalSales = branch.sales.reduce((sum: number, sale: { totalAmount: { toNumber: () => number } }) => sum + sale.totalAmount.toNumber(), 0);
    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      saleCount: branch._count.sales,
      totalSales,
    };
  });

  return NextResponse.json({
    todaySales: todaySales._sum?.totalAmount?.toNumber() || 0,
    weekSales: weekSales._sum?.totalAmount?.toNumber() || 0,
    monthSales: monthSales._sum?.totalAmount?.toNumber() || 0,
    revenue,
    profit,
    recentSales: recentSales.map((sale) => ({
      ...sale,
      cashier: sale.cashier ? { name: sale.cashier.name, email: sale.cashier.email } : null,
      totalAmount: sale.totalAmount.toNumber(),
      subtotal: sale.subtotal.toNumber(),
    })),
    topProducts: topProductsWithDetails,
    lowStock,
    branchPerformance: branchesPerformance,
  });
}
