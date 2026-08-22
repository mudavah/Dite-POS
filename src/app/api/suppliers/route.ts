import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { supplierSchema } from '@/lib/validators';
import { auditLog } from '@/lib/actions/audit';

import { toNumeric } from '@/lib/numeric';
import type { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { contactPerson: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (status) {
    where.status = status as 'ACTIVE' | 'INACTIVE';
  }

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      include: { _count: { select: { purchases: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.supplier.count({ where }),
  ]);

  const supplierIds = suppliers.map((s) => s.id);

  const purchasesBySupplier = await prisma.purchase.groupBy({
    by: ['supplierId'],
    where: supplierIds.length > 0 ? { supplierId: { in: supplierIds } } : undefined,
    _sum: { grandTotal: true, outstandingBalance: true, amountPaid: true },
    _count: { id: true },
  });

  const lastPurchaseDates = await prisma.purchase.groupBy({
    by: ['supplierId'],
    where: supplierIds.length > 0 ? { supplierId: { in: supplierIds } } : undefined,
    _max: { createdAt: true },
  });

  const supplierStats = new Map<string, { totalPurchases: number; totalAmountPurchased: number; outstandingBalance: number; lastPurchaseDate: string | null }>();

  for (const stat of purchasesBySupplier) {
    supplierStats.set(stat.supplierId, {
      totalPurchases: stat._count.id,
      totalAmountPurchased: toNumeric(stat._sum.grandTotal) || 0,
      outstandingBalance: toNumeric(stat._sum.outstandingBalance) || 0,
      lastPurchaseDate: null,
    });
  }

  for (const stat of lastPurchaseDates) {
    const existing = supplierStats.get(stat.supplierId);
    if (existing) {
      existing.lastPurchaseDate = stat._max.createdAt?.toISOString() || null;
    }
  }

  const enrichedSuppliers = suppliers.map((s) => {
    const stats = supplierStats.get(s.id) || { totalPurchases: 0, totalAmountPurchased: 0, outstandingBalance: 0, lastPurchaseDate: null };
    return {
      ...s,
      totalPurchases: stats.totalPurchases,
      totalAmountPurchased: stats.totalAmountPurchased,
      outstandingBalance: stats.outstandingBalance,
      lastPurchaseDate: stats.lastPurchaseDate,
    };
  });

  const totalPurchasesResult = await prisma.purchase.aggregate({
    where: {},
    _sum: { grandTotal: true },
    _count: { id: true },
  });

  const activeSuppliers = await prisma.supplier.count({ where: { status: 'ACTIVE' } });

  const outstandingBalanceResult = await prisma.purchase.aggregate({
    where: { status: { in: ['ORDERED', 'RECEIVED', 'PARTIALLY_RECEIVED'] as const } },
    _sum: { outstandingBalance: true },
  });

  return NextResponse.json({
    suppliers: enrichedSuppliers,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    summary: {
      totalSuppliers: total,
      activeSuppliers,
      totalPurchases: totalPurchasesResult._count.id || 0,
      totalAmountPurchased: toNumeric(totalPurchasesResult._sum?.grandTotal) || 0,
      outstandingBalance: toNumeric(outstandingBalanceResult._sum?.outstandingBalance) || 0,
    },
  });
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = supplierSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.flatten() }, { status: 400 });
    }

    const supplier = await prisma.supplier.create({
      data: validated.data,
    });

    await auditLog({
      userId: session.user.id,
      action: 'SUPPLIER_ADDED',
      entity: 'Supplier',
      entityId: supplier.id,
      newValues: JSON.stringify(supplier),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error('Supplier creation failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to create supplier';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
