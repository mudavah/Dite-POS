'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { productSchema, ProductInput } from '@/lib/validators';
import { auth } from '@/lib/auth';
import { auditLog } from '@/lib/actions/audit';

import { toNumeric, toNullableNumeric } from '@/lib/numeric';
import { StockMovementType } from '@prisma/client';

async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function createProduct(data: unknown) {
  const session = await requireAuth();
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    throw new Error('Unauthorized');
  }

  const validated = productSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.flatten() };
  }

  const product = await prisma.product.create({
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

  if (validated.data.openingStock && validated.data.openingStock > 0) {
    const branchId = session.user.branchId as string;
    if (branchId) {
      let inventory = await prisma.inventory.findUnique({
        where: { branchId_productId: { branchId, productId: product.id } },
      });

      if (!inventory) {
        inventory = await prisma.inventory.create({
          data: {
            branchId,
            productId: product.id,
            quantity: validated.data.openingStock,
          },
        });
      } else {
        await prisma.inventory.update({
          where: { id: inventory.id },
          data: { quantity: { increment: validated.data.openingStock } },
        });
      }

      const oldStock = inventory.quantity - validated.data.openingStock;

      await prisma.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          type: StockMovementType.OPENING_STOCK,
          quantity: validated.data.openingStock,
          reference: 'Opening Stock',
          notes: `Opening stock for ${product.name}`,
          createdById: session.user.id,
        },
      });

      await prisma.inventoryTransaction.create({
        data: {
          inventoryId: inventory.id,
          productId: product.id,
          branchId,
          type: StockMovementType.OPENING_STOCK,
          quantity: validated.data.openingStock,
          previousStock: oldStock,
          newStock: inventory.quantity,
          referenceNumber: 'OPENING',
          notes: `Opening stock for ${product.name}`,
          createdById: session.user.id,
        },
      });
    }
  }

  await auditLog({
    userId: session.user.id,
    action: 'PRODUCT_CREATED',
    entity: 'Product',
    entityId: product.id,
    newValues: JSON.stringify(product),
  });

  revalidatePath('/products');
  revalidatePath('/inventory');
  revalidatePath('/dashboard');
  return { data: { ...product, price: toNumeric(product.price), costPrice: toNullableNumeric(product.costPrice) } };
}

export async function updateProduct(id: string, data: unknown) {
  const session = await requireAuth();
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    throw new Error('Unauthorized');
  }

  const validated = productSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.flatten() };
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
  });

  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
  revalidatePath('/inventory');
  return { data: { ...product, price: toNumeric(product.price), costPrice: toNullableNumeric(product.costPrice) } };
}

export async function deleteProduct(id: string) {
  const session = await requireAuth();
  if (session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized');
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
  return { success: true };
}

export async function bulkUpdateProducts(ids: string[], data: { isActive?: boolean; isArchived?: boolean }) {
  const session = await requireAuth();
  if (session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized');
  }

  await prisma.product.updateMany({
    where: { id: { in: ids } },
    data,
  });

  await auditLog({
    userId: session.user.id,
    action: 'PRODUCTS_BULK_UPDATE',
    entity: 'Product',
    newValues: JSON.stringify({ ids, data }),
  });

  revalidatePath('/products');
  return { success: true };
}