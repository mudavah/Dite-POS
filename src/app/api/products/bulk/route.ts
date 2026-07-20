import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action, productIds, data } = body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return NextResponse.json({ error: 'No product IDs provided' }, { status: 400 });
  }

  if (action === 'archive') {
    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { isArchived: true, isActive: false },
    });
  } else if (action === 'unarchive') {
    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { isArchived: false, isActive: true },
    });
  } else if (action === 'delete') {
    await prisma.product.deleteMany({
      where: { id: { in: productIds } },
    });
  } else if (action === 'update') {
    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data,
    });
  }

  return NextResponse.json({ success: true });
}
