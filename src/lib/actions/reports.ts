'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/app/api/auth/[...nextauth]/route';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function getDashboardStats() {
  await requireAdmin();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

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
      where: { createdAt: { gte: today }, paymentStatus: 'COMPLETED' },
      _sum: { totalAmount: true, subtotal: true },
    }),
    prisma.sale.aggregate({
      where: { createdAt: { gte: weekStart }, paymentStatus: 'COMPLETED' },
      _sum: { totalAmount: true },
    }),
    prisma.sale.aggregate({
      where: { createdAt: { gte: monthStart }, paymentStatus: 'COMPLETED' },
      _sum: { totalAmount: true },
    }),
    prisma.sale.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { cashier: { select: { name: true, email: true } }, branch: { select: { name: true, code: true } } },
    }),
    prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { createdAt: { gte: monthStart }, paymentStatus: 'COMPLETED' } },
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

  const revenue = monthSales._sum.totalAmount?.toNumber() || 0;
  const branchesPerformance = branchPerformance.map((branch) => {
    const totalSales = branch.sales.reduce((sum, sale) => sum + sale.totalAmount.toNumber(), 0);
    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      saleCount: branch._count.sales,
      totalSales,
    };
  });

  return {
    todaySales: todaySales._sum.totalAmount?.toNumber() || 0,
    weekSales: weekSales._sum.totalAmount?.toNumber() || 0,
    monthSales: monthSales._sum.totalAmount?.toNumber() || 0,
    revenue,
    profit: revenue,
    recentSales: recentSales.map((sale) => ({
      ...sale,
      cashier: sale.cashier ? { name: sale.cashier.name, email: sale.cashier.email } : null,
      totalAmount: sale.totalAmount.toNumber(),
      subtotal: sale.subtotal.toNumber(),
    })),
    topProducts: topProductsWithDetails,
    lowStock,
    branchPerformance: branchesPerformance,
  };
}
