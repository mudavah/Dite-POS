import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { productSchema } from '@/lib/validators';
import { auditLog } from '@/lib/actions/audit';
import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true, purchaseItems: { select: { id: true } }, inventories: { select: { quantity: true, branch: { select: { name: true } } } } },
  });

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...product,
    price: product.price.toNumber(),
    costPrice: product.costPrice?.toNumber() || null,
    taxRate: product.taxRate.toNumber(),
    discount: product.discount.toNumber(),
    totalStock: product.inventories?.reduce((sum, inv) => sum + inv.quantity, 0) || 0,
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const validated = productSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json({ error: validated.error.flatten() }, { status: 400 });
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      name: validated.data.name,
      sku: validated.data.sku,
      barcode: validated.data.barcode || undefined,
      description: validated.data.description || undefined,
      price: validated.data.price,
      costPrice: validated.data.costPrice || null,
      categoryId: validated.data.categoryId || undefined,
      lowStockThreshold: validated.data.lowStockThreshold,
      maxStock: validated.data.maxStock || 1000,
      brand: validated.data.brand || undefined,
      unit: validated.data.unit,
      reorderLevel: validated.data.reorderLevel,
      taxRate: validated.data.taxRate,
      discount: validated.data.discount,
      image: validated.data.image || undefined,
      isActive: validated.data.isActive,
    },
  });

  await auditLog({
    userId: session.user.id,
    action: 'PRODUCT_UPDATED',
    entity: 'Product',
    entityId: id,
    newValues: JSON.stringify(product),
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
  });

  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
  revalidatePath('/inventory');

  return NextResponse.json({
    ...product,
    price: product.price.toNumber(),
    costPrice: product.costPrice?.toNumber() || null,
    taxRate: product.taxRate.toNumber(),
    discount: product.discount.toNumber(),
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.product.update({
    where: { id },
    data: { isArchived: true },
  });

  await auditLog({
    userId: session.user.id,
    action: 'PRODUCT_ARCHIVED',
    entity: 'Product',
    entityId: id,
  });

  revalidatePath('/products');
  return NextResponse.json({ success: true });
}
