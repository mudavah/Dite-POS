'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { userSchema } from '@/lib/validators';
import { hash } from 'bcryptjs';

export async function getUsers() {
  return await prisma.user.findMany({
    include: { branch: { select: { name: true, code: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function createUser(data: unknown) {
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
  const validated = userSchema.safeParse(data);
  if (!validated.success) {
    return { error: validated.error.flatten() };
  }

  const { password, ...userData } = validated.data;
  const updateData: any = { ...userData };
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
  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  revalidatePath('/users');
  return { success: true };
}
