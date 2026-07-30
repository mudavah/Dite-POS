import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


import { toNumeric } from '@/lib/numeric';
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
    todayPurchases,
    monthPurchases,
    totalPurchases,
    recentPurchases,
    topPurchasedProducts,
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
    prisma.purchase.aggregate({
      where: { ...branchFilter, createdAt: { gte: today } },
      _sum: { grandTotal: true },
      _count: true,
    }),
    prisma.purchase.aggregate({
      where: { ...branchFilter, createdAt: { gte: monthStart } },
      _sum: { grandTotal: true },
      _count: true,
    }),
    prisma.purchase.aggregate({
      where: branchFilter,
      _sum: { grandTotal: true },
      _count: true,
    }),
    prisma.purchase.findMany({
      where: { ...branchFilter, createdAt: { gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000) } },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { supplier: { select: { name: true } }, items: true },
    }),
    prisma.purchaseItem.groupBy({
      by: ['productId'],
      where: {
        purchase: { ...branchFilter, createdAt: { gte: monthStart } },
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: 5,
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

  const revenue = toNumeric(monthSales._sum?.totalAmount) || 0;
  const cost = await prisma.saleItem.aggregate({
    where: {
      sale: { ...branchFilter, createdAt: { gte: monthStart }, paymentStatus: 'COMPLETED' },
    },
    _sum: { total: true },
  });
  const totalCost = toNumeric(cost._sum?.total) || 0;
  const profit = revenue - totalCost;

  const branchesPerformance = branchPerformance.map((branch) => {
    const totalSales = branch.sales.reduce((sum: number, sale: { totalAmount: { toNumber: () => number } }) => sum + toNumeric(sale.totalAmount), 0);
    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      saleCount: branch._count.sales,
      totalSales,
    };
  });

return NextResponse.json({
    todaySales: toNumeric(todaySales._sum?.totalAmount) || 0,
    weekSales: toNumeric(weekSales._sum?.totalAmount) || 0,
    monthSales: toNumeric(monthSales._sum?.totalAmount) || 0,
    revenue,
    profit,
    todayPurchases: todayPurchases._count || 0,
    monthPurchases: monthPurchases._count || 0,
    totalPurchases: totalPurchases._count || 0,
    totalPurchaseValue: toNumeric(totalPurchases._sum?.grandTotal) || 0,
    recentPurchases: recentPurchases.map((p: any) => ({
      id: p.id,
      purchaseNumber: p.purchaseNumber,
      supplier: p.supplier?.name || '-',
      date: p.purchaseDate.toISOString(),
      grandTotal: toNumeric(p.grandTotal),
      status: p.status,
      items: p.items?.length || 0,
    })),
    topPurchasedProducts: (topPurchasedProducts || []).map((item: any) => {
      const product = topProductsWithDetails.find((p: any) => p.productId === item.productId);
      return { ...item, product };
    }),
    recentSales: recentSales.map((sale: any) => ({
      ...sale,
      cashier: sale.cashier ? { name: sale.cashier.name, email: sale.cashier.email } : null,
      totalAmount: toNumeric(sale.totalAmount),
      subtotal: toNumeric(sale.subtotal),
    })),
    topProducts: topProductsWithDetails,
    lowStock,
    branchPerformance: branchesPerformance,
  });
}
