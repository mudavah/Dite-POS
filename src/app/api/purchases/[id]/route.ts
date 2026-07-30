import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { purchaseSchema } from '@/lib/validators';
import { auditLog } from '@/lib/actions/audit';

import { toNumeric } from '@/lib/numeric';
import { revalidatePath } from 'next/cache';
import { StockMovementType } from '@prisma/client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      branch: { select: { name: true, code: true } },
      user: { select: { name: true, email: true } },
      items: {
        include: {
          product: { select: { name: true, sku: true, barcode: true } },
        },
      },
      attachments: true,
    },
  });

  if (!purchase) {
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...purchase,
    subtotal: toNumeric(purchase.subtotal),
    discountAmount: toNumeric(purchase.discountAmount),
    taxAmount: toNumeric(purchase.taxAmount),
    grandTotal: toNumeric(purchase.grandTotal),
    amountPaid: toNumeric(purchase.amountPaid),
    outstandingBalance: toNumeric(purchase.outstandingBalance),
    purchaseNumber: purchase.purchaseNumber,
    invoiceNumber: purchase.invoiceNumber ?? undefined,
    deliveryNote: purchase.deliveryNote ?? undefined,
    notes: purchase.notes ?? undefined,
    referenceNumber: purchase.purchaseNumber,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const validated = purchaseSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json({ error: validated.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.purchase.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
  }

  const oldValues = JSON.stringify(existing);

  const purchase = await prisma.$transaction(async (tx) => {
    const updated = await tx.purchase.update({
      where: { id },
      data: {
        supplierId: validated.data.supplierId,
        purchaseDate: validated.data.purchaseDate ? new Date(validated.data.purchaseDate) : undefined,
        invoiceNumber: (validated.data.invoiceNumber as string) || undefined,
        deliveryNote: (validated.data.deliveryNote as string) || undefined,
        paymentMethod: validated.data.paymentMethod,
        status: validated.data.status || 'DRAFT',
        notes: (validated.data.notes as string) || undefined,
        items: {
          deleteMany: {},
          create: validated.data.items.map((item) => ({
            productId: item.productId || undefined,
            productName: item.productName,
            sku: (item.sku as string) || undefined,
            barcode: (item.barcode as string) || undefined,
            quantity: item.quantity,
            buyingPrice: item.buyingPrice,
            sellingPrice: item.sellingPrice,
            discount: item.discount,
            tax: item.tax,
            lineTotal: item.lineTotal,
            notes: (item.notes as string) || undefined,
          })),
        },
      },
      include: { items: true },
    });

    await auditLog({
      userId: session.user.id,
      action: 'PURCHASE_EDITED',
      entity: 'Purchase',
      entityId: id,
      oldValues,
      newValues: JSON.stringify(updated),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    return updated;
  });

  revalidatePath('/purchases');
  revalidatePath(`/purchases/${id}`);

  return NextResponse.json(purchase);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existing = await prisma.purchase.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
    await tx.purchaseAttachment.deleteMany({ where: { purchaseId: id } });
    await tx.purchase.delete({ where: { id } });

    await auditLog({
      userId: session.user.id,
      action: 'PURCHASE_DELETED',
      entity: 'Purchase',
      entityId: id,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });
  });

  revalidatePath('/purchases');
  revalidatePath('/inventory');

  return NextResponse.json({ success: true });
}