import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { fromBranchId, toBranchId, productId, quantity, notes } = body;

  if (!fromBranchId || !toBranchId || !productId || !quantity) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const transfer = await prisma.stockTransfer.create({
    data: {
      fromBranchId,
      toBranchId,
      productId,
      quantity,
      notes,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(transfer);
}
