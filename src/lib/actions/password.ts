'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { hash } from 'bcryptjs';
import { auth } from '@/app/api/auth/[...nextauth]/route';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function changeUserPassword(userId: string, newPassword: string) {
  await requireAdmin();
  if (!newPassword || newPassword.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }

  const hashedPassword = await hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  revalidatePath('/users');
  return { success: true };
}
