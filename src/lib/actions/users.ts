'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { userSchema } from '@/lib/validators';
import { hash } from 'bcryptjs';
import type { Prisma } from '@prisma/client';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function getUsers() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized');
  }
  return await prisma.user.findMany({
    include: { branch: { select: { name: true, code: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function createUser(data: unknown) {
  await requireAdmin();
  const validated = userSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.flatten() };
  }

  const { password, ...userData } = validated.data;
  const hashedPassword = password ? await hash(password, 12) : undefined;

  const user = await prisma.user.create({
    data: { ...userData, password: hashedPassword },
  });

  revalidatePath('/users');
  return { data: { ...user, password: undefined } };
}

export async function updateUser(id: string, data: unknown) {
  await requireAdmin();
  const validated = userSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.flatten() };
  }

  const { password, ...userData } = validated.data;
  const updateData: Prisma.UserUpdateInput = { ...userData };
  if (password) {
    updateData.password = await hash(password, 12);
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  revalidatePath('/users');
  return { data: { ...user, password: undefined } };
}

export async function deleteUser(id: string) {
  await requireAdmin();
  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  revalidatePath('/users');
  return { success: true };
}
