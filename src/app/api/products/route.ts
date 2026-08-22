import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { productSchema } from '@/lib/validators';
import { sanitizeText } from '@/lib/utils';
import { auditLog } from '@/lib/actions/audit';

import { toNumeric, toNullableNumeric } from '@/lib/numeric';
import { revalidatePath } from 'next/cache';
import { StockMovementType } from '@prisma/client';
import type { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const brand = searchParams.get('brand') || '';
  const supplierId = searchParams.get('supplierId') || '';
  const status = searchParams.get('status') || '';
  const archived = searchParams.get('archived') || 'false';
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {
    isArchived: archived === 'true',
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
      { brand: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (brand) {
    where.brand = { contains: brand, mode: 'insensitive' };
  }

  if (supplierId) {
    where.purchaseItems = { some: { purchase: { supplierId: supplierId } } };
  }

  if (status === 'active') {
    where.isActive = true;
  } else if (status === 'inactive') {
    where.isActive = false;
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true, purchaseItems: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const suppliers = await prisma.supplier.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    products: products.map((p) => ({
      ...p,
      price: toNumeric(p.price),
      costPrice: toNullableNumeric(p.costPrice),
      taxRate: toNumeric(p.taxRate),
      discount: toNumeric(p.discount),
      purchaseCount: p.purchaseItems?.length || 0,
    })),
    categories,
    suppliers,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = productSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.flatten() }, { status: 400 });
    }

    const sanitized = {
      ...validated.data,
      name: sanitizeText(validated.data.name)!,
      description: sanitizeText(validated.data.description),
      barcode: sanitizeText(validated.data.barcode),
      brand: sanitizeText(validated.data.brand),
      unit: validated.data.unit,
      reorderLevel: validated.data.reorderLevel,
      maxStock: validated.data.maxStock,
      taxRate: validated.data.taxRate,
      discount: validated.data.discount,
      costPrice: validated.data.costPrice,
      openingStock: validated.data.openingStock,
      defaultSupplierId: validated.data.defaultSupplierId,
    };

    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          name: sanitized.name,
          sku: sanitized.sku,
          barcode: sanitized.barcode || undefined,
          description: sanitized.description || undefined,
          price: sanitized.price,
          costPrice: sanitized.costPrice || null,
          categoryId: sanitized.categoryId || undefined,
          lowStockThreshold: sanitized.lowStockThreshold,
          maxStock: sanitized.maxStock,
          brand: sanitized.brand || undefined,
          unit: sanitized.unit,
          reorderLevel: sanitized.reorderLevel,
          taxRate: sanitized.taxRate,
          discount: sanitized.discount,
          image: sanitized.image || undefined,
          isActive: sanitized.isActive,
        },
      });

      if (sanitized.openingStock && sanitized.openingStock > 0) {
        let inventory = await tx.inventory.findUnique({
          where: { branchId_productId: { branchId: session.user!.branchId as string, productId: newProduct.id } },
        });

        if (!inventory) {
          inventory = await tx.inventory.create({
            data: {
              branchId: session.user!.branchId as string,
              productId: newProduct.id,
              quantity: sanitized.openingStock,
            },
          });
        } else {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantity: { increment: sanitized.openingStock } },
          });
        }

        const oldStock = inventory.quantity - sanitized.openingStock;

        await tx.stockMovement.create({
          data: {
            inventoryId: inventory.id,
            type: StockMovementType.OPENING_STOCK,
            quantity: sanitized.openingStock,
            reference: 'Opening Stock',
            notes: `Opening stock for ${newProduct.name}`,
            createdById: session.user!.id,
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            inventoryId: inventory.id,
            productId: newProduct.id,
            branchId: session.user!.branchId as string,
            type: StockMovementType.OPENING_STOCK,
            quantity: sanitized.openingStock,
            previousStock: oldStock,
            newStock: inventory.quantity,
            referenceNumber: 'OPENING',
            notes: `Opening stock for ${newProduct.name}`,
            createdById: session.user!.id,
          },
        });
      }

      await auditLog({
        userId: session.user!.id,
        action: 'PRODUCT_CREATED',
        entity: 'Product',
        entityId: newProduct.id,
        newValues: JSON.stringify(newProduct),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      });

      return newProduct;
    });

    revalidatePath('/products');
    revalidatePath('/inventory');
    revalidatePath('/dashboard');

    return NextResponse.json({
      ...product,
      price: toNumeric(product.price),
      costPrice: toNumeric(product.costPrice) || null,
      taxRate: toNumeric(product.taxRate),
      discount: toNumeric(product.discount),
    }, { status: 201 });
  } catch (error) {
    console.error('Product creation failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to create product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
