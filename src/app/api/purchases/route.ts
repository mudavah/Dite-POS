import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { purchaseSchema } from '@/lib/validators';
import { auditLog } from '@/lib/actions/audit';

import { toNumeric } from '@/lib/numeric';
import { revalidatePath } from 'next/cache';
import { StockMovementType } from '@prisma/client';
import type { Prisma } from '@prisma/client';

function generatePurchaseNumber() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PUR-${dateStr}-${random}`;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const supplierId = searchParams.get('supplierId') || '';
  const status = searchParams.get('status') || '';
  const branchId = searchParams.get('branchId') || '';
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { purchaseNumber: { contains: search, mode: 'insensitive' } },
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { supplier: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  if (supplierId) where.supplierId = supplierId;
  if (status) where.status = status;
  if (branchId) where.branchId = branchId;

  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: {
        supplier: { select: { name: true, phone: true, email: true } },
        branch: { select: { name: true, code: true } },
        user: { select: { name: true, email: true } },
        items: {
          select: {
            id: true,
            productName: true,
            sku: true,
            quantity: true,
            buyingPrice: true,
            sellingPrice: true,
            discount: true,
            tax: true,
            lineTotal: true,
            productId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.purchase.count({ where }),
  ]);

  return NextResponse.json({
    purchases: purchases.map((p) => ({
      ...p,
      subtotal: toNumeric(p.subtotal),
      discountAmount: toNumeric(p.discountAmount),
      taxAmount: toNumeric(p.taxAmount),
      grandTotal: toNumeric(p.grandTotal),
      amountPaid: toNumeric(p.amountPaid),
      outstandingBalance: toNumeric(p.outstandingBalance),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const validated = purchaseSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json({ error: validated.error.flatten() }, { status: 400 });
  }

  const purchaseNumber = generatePurchaseNumber();

  const purchase = await prisma.$transaction(async (tx) => {
    const newPurchase = await tx.purchase.create({
      data: {
        purchaseNumber,
        userId: session.user!.id,
        branchId: session.user!.branchId as string,
        supplierId: validated.data.supplierId,
        purchaseDate: validated.data.purchaseDate ? new Date(validated.data.purchaseDate) : undefined,
        invoiceNumber: validated.data.invoiceNumber || undefined,
        deliveryNote: validated.data.deliveryNote || undefined,
        paymentMethod: validated.data.paymentMethod,
        status: validated.data.status || 'DRAFT',
        notes: validated.data.notes || undefined,
        subtotal: validated.data.items.reduce((sum, item) => sum + item.lineTotal, 0),
        discountAmount: validated.data.items.reduce((sum, item) => sum + item.discount, 0),
        taxAmount: validated.data.items.reduce((sum, item) => sum + item.tax, 0),
        grandTotal: validated.data.items.reduce((sum, item) => sum + item.lineTotal, 0),
        items: {
          create: validated.data.items.map((item) => ({
            productId: item.productId || undefined,
            productName: item.productName,
            sku: item.sku || undefined,
            barcode: item.barcode || undefined,
            quantity: item.quantity,
            buyingPrice: item.buyingPrice,
            sellingPrice: item.sellingPrice,
            discount: item.discount,
            tax: item.tax,
            lineTotal: item.lineTotal,
            notes: item.notes || undefined,
          })),
        },
      },
    });

    await auditLog({
      userId: session.user!.id,
      action: 'PURCHASE_CREATED',
      entity: 'Purchase',
      entityId: newPurchase.id,
      newValues: JSON.stringify(newPurchase),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    return newPurchase;
  });

  revalidatePath('/purchases');
  revalidatePath('/inventory');
  revalidatePath('/dashboard');

  return NextResponse.json({ ...purchase, purchaseNumber }, { status: 201 });
}