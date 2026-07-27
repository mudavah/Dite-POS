'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { supplierSchema, purchaseSchema } from '@/lib/validators';
import { auditLog } from '@/lib/actions/audit';
import { StockMovementType } from '@prisma/client';

async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function createSupplier(data: unknown) {
  const session = await requireAuth();
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    throw new Error('Unauthorized');
  }

  const validated = supplierSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.flatten() };
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
  });

  revalidatePath('/suppliers');
  return { data: supplier };
}

export async function updateSupplier(id: string, data: unknown) {
  const session = await requireAuth();
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    throw new Error('Unauthorized');
  }

  const validated = supplierSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.flatten() };
  }

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) {
    return { error: 'Supplier not found' };
  }

  const oldValues = JSON.stringify(existing);

  const supplier = await prisma.supplier.update({
    where: { id },
    data: validated.data,
  });

  await auditLog({
    userId: session.user.id,
    action: 'SUPPLIER_EDITED',
    entity: 'Supplier',
    entityId: id,
    oldValues,
    newValues: JSON.stringify(supplier),
  });

  revalidatePath('/suppliers');
  return { data: supplier };
}

export async function deleteSupplier(id: string) {
  const session = await requireAuth();
  if (session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized');
  }

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) {
    return { error: 'Supplier not found' };
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
  });

  revalidatePath('/suppliers');
  return { success: true };
}

export async function createPurchase(data: unknown) {
  const session = await requireAuth();
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    throw new Error('Unauthorized');
  }

  const validated = purchaseSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.flatten() };
  }

  const purchaseNumber = `PUR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const purchase = await prisma.$transaction(async (tx) => {
    const purchaseData: any = {
      purchaseNumber,
      userId: session.user.id,
      supplierId: validated.data.supplierId,
      purchaseDate: validated.data.purchaseDate ? new Date(validated.data.purchaseDate) : undefined,
      invoiceNumber: validated.data.invoiceNumber || undefined,
      deliveryNote: validated.data.deliveryNote || undefined,
      paymentMethod: validated.data.paymentMethod,
      status: validated.data.status || 'DRAFT',
      notes: validated.data.notes || undefined,
      subtotal: validated.data.items.reduce((sum, item) => sum + item.lineTotal, 0),
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
    };

    if (session.user.branchId) {
      purchaseData.branchId = session.user.branchId;
    }

    const newPurchase = await tx.purchase.create({
      data: purchaseData,
    });

    await auditLog({
      userId: session.user.id,
      action: 'PURCHASE_CREATED',
      entity: 'Purchase',
      entityId: newPurchase.id,
      newValues: JSON.stringify(newPurchase),
    });

    return newPurchase;
  });

  revalidatePath('/purchases');
  revalidatePath('/inventory');
  return { data: purchase };
}

export async function receivePurchase(purchaseId: string) {
  const session = await requireAuth();
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    throw new Error('Unauthorized');
  }

  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { items: true },
  });

  if (!purchase) {
    return { error: 'Purchase not found' };
  }

  if (purchase.status === 'RECEIVED') {
    return { error: 'Purchase already received' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchase.update({
      where: { id: purchaseId },
      data: {
        status: 'RECEIVED',
        receivedAt: new Date(),
      },
    });

    for (const item of purchase.items) {
      let inventory = await tx.inventory.findUnique({
        where: { branchId_productId: { branchId: purchase.branchId, productId: item.productId! } },
      });

      if (!inventory) {
        inventory = await tx.inventory.create({
          data: {
            branchId: purchase.branchId,
            productId: item.productId!,
            quantity: item.quantity,
          },
        });
      } else {
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: { increment: item.quantity } },
        });
      }

      await tx.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          type: StockMovementType.PURCHASE,
          quantity: item.quantity,
          reference: purchase.purchaseNumber,
          notes: `Purchase ${purchase.purchaseNumber}`,
          createdById: session.user.id,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryId: inventory.id,
          productId: item.productId!,
          branchId: purchase.branchId,
          type: StockMovementType.PURCHASE,
          quantity: item.quantity,
          previousStock: inventory.quantity,
          newStock: inventory.quantity + item.quantity,
          referenceNumber: purchase.purchaseNumber,
          notes: `Purchase ${purchase.purchaseNumber}`,
          createdById: session.user.id,
        },
      });

      if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            costPrice: item.buyingPrice,
            price: item.sellingPrice,
          },
        });
      }
    }

    await auditLog({
      userId: session.user.id,
      action: 'PURCHASE_RECEIVED',
      entity: 'Purchase',
      entityId: purchaseId,
      newValues: JSON.stringify({ status: 'RECEIVED', receivedAt: new Date() }),
    });
  });

  revalidatePath('/purchases');
  revalidatePath('/inventory');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function getSuppliers(params?: Record<string, string>) {
  await requireAuth();
  const where: Record<string, unknown> = {};
  if (params?.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { companyName: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params?.status) {
    where.status = params.status;
  }

  const suppliers = await prisma.supplier.findMany({
    where,
    include: { _count: { select: { purchases: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return suppliers.map((s) => ({
    ...s,
    status: s.status,
  }));
}

export async function getPurchases(params?: Record<string, string>) {
  await requireAuth();
  const where: Record<string, unknown> = {};
  if (params?.search) {
    where.OR = [
      { purchaseNumber: { contains: params.search, mode: 'insensitive' } },
      { invoiceNumber: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params?.supplierId) where.supplierId = params.supplierId;
  if (params?.status) where.status = params.status;

  const purchases = await prisma.purchase.findMany({
    where,
    include: {
      supplier: { select: { name: true, phone: true } },
      branch: { select: { name: true } },
      user: { select: { name: true } },
      items: { select: { id: true, productName: true, quantity: true, buyingPrice: true, lineTotal: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return purchases.map((p) => ({
    ...p,
    subtotal: p.subtotal.toNumber(),
    discountAmount: p.discountAmount.toNumber(),
    taxAmount: p.taxAmount.toNumber(),
    grandTotal: p.grandTotal.toNumber(),
    amountPaid: p.amountPaid.toNumber(),
    outstandingBalance: p.outstandingBalance.toNumber(),
  }));
}