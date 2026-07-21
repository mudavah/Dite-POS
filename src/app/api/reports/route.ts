import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseDate(param: string | null): Date | undefined {
  if (!param) return undefined;
  const date = new Date(param);
  return isNaN(date.getTime()) ? undefined : date;
}

function formatCurrency(value: number): string {
  return `KSh ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatReportDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'sales';
  const startDate = parseDate(searchParams.get('startDate'));
  const endDate = parseDate(searchParams.get('endDate'));
  const limit = Math.min(parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10), MAX_LIMIT);
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const skip = (page - 1) * limit;

  const where: any = { paymentStatus: 'COMPLETED' };
  if (startDate) where.createdAt = { ...where.createdAt, gte: startDate };
  if (endDate) where.createdAt = { ...where.createdAt, lte: endDate };

  let data: any = null;
  let total = 0;

  if (type === 'sales') {
    const [sales, count] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          cashier: { select: { name: true, email: true } },
          branch: { select: { name: true, code: true } },
          receipts: { select: { receiptNo: true } },
          items: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    total = count;
    data = sales.map((sale) => ({
      id: sale.id,
      receiptNo: sale.receipts?.[0]?.receiptNo || '-',
      date: formatReportDate(sale.createdAt),
      cashier: sale.cashier?.name || '-',
      branch: sale.branch?.name || '-',
      paymentMethod: sale.paymentMethod,
      items: sale.items?.length || 0,
      subtotal: formatCurrency(sale.subtotal.toNumber()),
      discount: formatCurrency(sale.discountAmount.toNumber()),
      total: formatCurrency(sale.totalAmount.toNumber()),
      rawTotal: sale.totalAmount.toNumber(),
    }));
  } else if (type === 'products') {
    const products = await prisma.product.findMany({
      where: { isArchived: false },
      include: { 
        category: { select: { name: true } },
        inventories: { select: { quantity: true } },
      },
      orderBy: { name: 'asc' },
    });

    data = products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category?.name || 'Uncategorized',
      price: formatCurrency(product.price.toNumber()),
      costPrice: product.costPrice ? formatCurrency(product.costPrice.toNumber()) : '-',
      stock: product.inventories?.reduce((sum, inv) => sum + inv.quantity, 0) || 0,
      status: product.isActive ? 'Active' : 'Inactive',
    }));
    total = products.length;
  } else if (type === 'inventory') {
    const inventory = await prisma.inventory.findMany({
      where,
      include: {
        product: { select: { name: true, sku: true, price: true, costPrice: true } },
        branch: { select: { name: true, code: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    });

    total = await prisma.inventory.count({ where });
    data = inventory.map((inv) => ({
      id: inv.id,
      product: inv.product?.name || '-',
      sku: inv.product?.sku || '-',
      branch: inv.branch?.name || '-',
      quantity: inv.quantity,
      value: formatCurrency((inv.product?.costPrice?.toNumber?.() || inv.product?.price?.toNumber?.() || 0) * inv.quantity),
      rawValue: (inv.product?.costPrice?.toNumber?.() || inv.product?.price?.toNumber?.() || 0) * inv.quantity,
    }));
  } else if (type === 'profit') {
    const sales = await prisma.sale.findMany({
      where,
      include: {
        cashier: { select: { name: true } },
        branch: { select: { name: true } },
        items: { include: { product: { select: { costPrice: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    total = await prisma.sale.count({ where });
    data = sales.map((sale) => {
      const cost = sale.items.reduce((sum, item) => sum + (item.product?.costPrice?.toNumber?.() || 0) * item.quantity, 0);
      const profit = sale.totalAmount.toNumber() - cost;
      return {
        id: sale.id,
        date: formatReportDate(sale.createdAt),
        cashier: sale.cashier?.name || '-',
        branch: sale.branch?.name || '-',
        revenue: formatCurrency(sale.totalAmount.toNumber()),
        cost: formatCurrency(cost),
        profit: formatCurrency(profit),
        rawProfit: profit,
      };
    });
  } else if (type === 'cashiers') {
    const cashiers = await prisma.user.findMany({
      where: { role: 'CASHIER', isActive: true },
      include: {
        sales: {
          where: { paymentStatus: 'COMPLETED' },
          select: { totalAmount: true, createdAt: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    data = cashiers.map((cashier) => {
      const totalSales = cashier.sales.reduce((sum, s) => sum + s.totalAmount.toNumber(), 0);
      return {
        id: cashier.id,
        name: cashier.name,
        email: cashier.email,
        salesCount: cashier.sales.length,
        totalSales: formatCurrency(totalSales),
        rawTotal: totalSales,
      };
    });
    total = cashiers.length;
  } else if (type === 'branches') {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      include: {
        sales: {
          where: { paymentStatus: 'COMPLETED' },
          select: { totalAmount: true, createdAt: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    data = branches.map((branch) => {
      const totalSales = branch.sales.reduce((sum, s) => sum + s.totalAmount.toNumber(), 0);
      return {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        salesCount: branch.sales.length,
        totalSales: formatCurrency(totalSales),
        rawTotal: totalSales,
      };
    });
    total = branches.length;
  } else if (type === 'category-sales') {
    const sales = await prisma.sale.findMany({
      where,
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
        const categoryName = item.product?.category?.name || 'Uncategorized';
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

    data = Object.values(categoryMap).map((cat) => ({
      category: cat.category,
      cash: formatCurrency(cat.cash),
      card: formatCurrency(cat.card),
      bankTransfer: formatCurrency(cat.bankTransfer),
      mobileMoney: formatCurrency(cat.mobileMoney),
      total: formatCurrency(cat.total),
      rawTotal: cat.total,
    }));
    total = data.length;
  }

  return NextResponse.json({ type, data, total, page, limit });
}
