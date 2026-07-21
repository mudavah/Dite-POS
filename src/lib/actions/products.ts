'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { productSchema } from '@/lib/validators';
import { auth } from '@/app/api/auth/[...nextauth]/route';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function createProduct(data: unknown) {
  await requireAdmin();
  const validated = productSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.flatten() };
  }

  const product = await prisma.product.create({
    data: validated.data,
  });

  revalidatePath('/products');
  return { data: { ...product, price: product.price.toNumber(), costPrice: product.costPrice?.toNumber() || null } };
}

export async function updateProduct(id: string, data: unknown) {
  await requireAdmin();
  const validated = productSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.flatten() };
  }

  const product = await prisma.product.update({
    where: { id },
    data: validated.data,
  });

  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
  return { data: { ...product, price: product.price.toNumber(), costPrice: product.costPrice?.toNumber() || null } };
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  await prisma.product.update({
    where: { id },
    data: { isArchived: true },
  });

  revalidatePath('/products');
  return { success: true };
}

export async function bulkUpdateProducts(ids: string[], data: { isActive?: boolean; isArchived?: boolean }) {
  await requireAdmin();
  await prisma.product.updateMany({
    where: { id: { in: ids } },
    data,
  });

  revalidatePath('/products');
  return { success: true };
}
