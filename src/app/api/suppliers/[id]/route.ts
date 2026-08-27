import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { supplierSchema, sanitizeSupplierInput } from '@/lib/validators';
import { auditLog } from '@/lib/actions/audit';


import { toNumeric } from '@/lib/numeric';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      purchases: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          purchaseNumber: true,
          purchaseDate: true,
          grandTotal: true,
          status: true,
          paymentMethod: true,
        },
      },
      _count: { select: { purchases: true } },
    },
  });

  if (!supplier) {
    return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
  }

  const totalPurchases = await prisma.purchase.aggregate({
    where: { supplierId: id },
    _sum: { grandTotal: true, outstandingBalance: true },
  });

  return NextResponse.json({
    ...supplier,
    totalPurchases: toNumeric(totalPurchases._sum.grandTotal) || 0,
    totalOutstandingBalance: toNumeric(totalPurchases._sum.outstandingBalance) || 0,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = supplierSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const oldValues = JSON.stringify(existing);

    const sanitized = sanitizeSupplierInput(validated.data);

    const supplier = await prisma.supplier.update({
      where: { id },
      data: sanitized,
    });

    await auditLog({
      userId: session.user.id,
      action: 'SUPPLIER_EDITED',
      entity: 'Supplier',
      entityId: id,
      oldValues,
      newValues: JSON.stringify(supplier),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    return NextResponse.json(supplier);
  } catch (error) {
    console.error('Supplier update failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to update supplier';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    await prisma.supplier.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    await auditLog({
      userId: session.user.id,
      action: 'SUPPLIER_DELETED',
      entity: 'Supplier',
      entityId: id,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Supplier deactivation failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to deactivate supplier';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}