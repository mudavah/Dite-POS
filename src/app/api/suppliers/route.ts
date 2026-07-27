import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { supplierSchema } from '@/lib/validators';
import { auditLog } from '@/lib/actions/audit';
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
      include: {
        _count: { select: { purchases: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.supplier.count({ where }),
  ]);

  const totalPurchasesResult = await prisma.purchase.aggregate({
    where: {},
    _sum: { grandTotal: true },
  });

  const activeSuppliers = await prisma.supplier.count({ where: { status: 'ACTIVE' } });

  const outstandingBalanceResult = await prisma.purchase.aggregate({
    where: { status: { in: ['ORDERED', 'RECEIVED', 'PARTIALLY_RECEIVED'] as const } },
    _sum: { outstandingBalance: true },
  });

  return NextResponse.json({
    suppliers,
    total,
    page,
    limit,
    summary: {
      totalSuppliers: total,
      activeSuppliers,
      totalPurchases: totalPurchasesResult._sum?.grandTotal ? 0 : 0,
      totalAmountPurchased: totalPurchasesResult._sum?.grandTotal?.toNumber() || 0,
      outstandingBalance: outstandingBalanceResult._sum?.outstandingBalance?.toNumber() || 0,
    },
  });
}

export async function POST(request: Request) {
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
}