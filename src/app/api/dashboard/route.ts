import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toNumeric } from '@/lib/numeric';
import { Prisma } from '@prisma/client';

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
  const branchFilter = isAdmin ? {} : { branchId: session.user.branchId ?? '' };

  const [
    todaySales,
    weekSales,
    monthSales,
    recentSales,
    topProducts,
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
      where: { ...branchFilter, createdAt: { gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000) }, paymentStatus: 'COMPLETED' },
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
    prisma.branch.findMany({
      where: isAdmin ? { isActive: true } : { id: session.user.branchId ?? '', isActive: true },
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
      return { ...item, product: product ?? { name: 'Unknown Product', sku: '', price: 0 } };
    })
  );

  const revenue = toNumeric(monthSales._sum?.totalAmount) || 0;

  const branchCostClause =
    isAdmin || !branchFilter.branchId
      ? Prisma.empty
      : Prisma.sql`AND "sales"."branchId" = ${branchFilter.branchId}`;

  const costResult = await prisma.$queryRaw<
    { productCost: number | null }[]
  >`
    SELECT COALESCE(SUM("sale_items"."quantity" * "products"."costPrice"), 0) AS "productCost"
    FROM "sale_items"
    INNER JOIN "products" ON "sale_items"."productId" = "products"."id"
    INNER JOIN "sales" ON "sale_items"."saleId" = "sales"."id"
    WHERE "sales"."createdAt" >= ${monthStart}
      AND "sales"."paymentStatus" = 'COMPLETED'
      ${branchCostClause}
  `;
  const totalCost = toNumeric(costResult[0]?.productCost) || 0;
  const profit = revenue - totalCost;

  const branchesPerformance = branchPerformance.map((branch) => {
    const totalSales = branch.sales.reduce((sum: number, sale: { totalAmount: { toNumber: () => number } }) => sum + toNumeric(sale.totalAmount), 0);
    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      saleCount: branch._count?.sales ?? 0,
      totalSales,
    };
  });

  const totalProducts = await prisma.inventory.count({
    where: branchFilter,
  });

  const inventoryValueResult = await prisma.inventory.findMany({
    where: branchFilter,
    include: {
      product: { select: { costPrice: true, price: true, lowStockThreshold: true, name: true, isArchived: true } },
      branch: { select: { name: true } },
    },
  });
  const inventoryValue = inventoryValueResult.reduce((sum, inv) => {
    const cost = toNumeric(inv.product.costPrice) || toNumeric(inv.product.price) || 0;
    return sum + inv.quantity * cost;
  }, 0);

  const lowStockList = inventoryValueResult.filter(
    (inv) => !inv.product.isArchived && inv.quantity <= inv.product.lowStockThreshold
  );
  const lowStock = lowStockList.length;
  const lowStockItems = lowStockList.slice(0, 10).map((inv) => ({
    id: inv.id,
    quantity: inv.quantity,
    product: { name: inv.product.name },
    branch: { name: inv.branch.name },
  }));

  const outOfStock = await prisma.inventory.count({
    where: { ...branchFilter, quantity: 0, product: { isArchived: false } },
  });

  const totalMovements = await prisma.stockMovement.count({
    where: { createdAt: { gte: monthStart } },
  });

  const topSuppliers = await prisma.purchase.groupBy({
    by: ['supplierId'],
    where: { ...branchFilter, createdAt: { gte: monthStart } },
    _sum: { grandTotal: true },
    _count: { id: true },
    orderBy: { _sum: { grandTotal: 'desc' } },
    take: 5,
  });
  const suppliersWithNames = await Promise.all(
    topSuppliers.map(async (s) => {
      const supplier = await prisma.supplier.findUnique({
        where: { id: s.supplierId },
        select: { name: true },
      });
      return {
        supplier: { name: supplier?.name ?? 'Unknown' },
        _sum: { grandTotal: s._sum.grandTotal },
        _count: { id: s._count.id },
      };
    })
  );

  const topPurchasedWithDetails = await Promise.all(
    topPurchasedProducts.map(async (item) => {
      if (!item.productId) return { ...item, product: undefined };
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true, sku: true, price: true },
      });
      return { ...item, product: product ?? undefined };
    })
  );

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
    totalProducts,
    inventoryValue,
    outOfStock,
    totalMovements,
    lowStock,
    lowStockItems,
    recentPurchases: recentPurchases.map((p) => ({
      id: p.id,
      purchaseNumber: p.purchaseNumber,
      supplier: p.supplier?.name || '-',
      date: p.purchaseDate.toISOString(),
      grandTotal: toNumeric(p.grandTotal),
      status: p.status,
      items: p.items?.length || 0,
    })),
    topPurchasedProducts: topPurchasedWithDetails,
    recentSales: recentSales.map((sale) => ({
      ...sale,
      cashier: sale.cashier ? { name: sale.cashier.name, email: sale.cashier.email } : null,
      totalAmount: toNumeric(sale.totalAmount),
      subtotal: toNumeric(sale.subtotal),
    })),
    topProducts: topProductsWithDetails,
    branchPerformance: branchesPerformance,
    topSuppliers: suppliersWithNames,
  });
}
