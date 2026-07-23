import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const branchId = session.user.branchId as string;

  const heldSales = await prisma.heldSale.findMany({
    where: { branchId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json(
    heldSales.map((s) => ({
      id: s.id,
      branchId: s.branchId,
      cashierId: s.cashierId,
      customerName: s.customerName,
      itemsJson: s.itemsJson,
      subtotal: s.subtotal.toNumber(),
      totalAmount: s.totalAmount.toNumber(),
      notes: s.notes,
      createdAt: s.createdAt.toISOString(),
    }))
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const branchId = session.user.branchId as string;
  const cashierId = session.user.id;

  const heldSale = await prisma.heldSale.create({
    data: {
      branchId,
      cashierId,
      customerName: body.customerName,
      itemsJson: JSON.stringify(body.items),
      subtotal: body.subtotal,
      totalAmount: body.totalAmount,
      notes: body.notes,
    },
  });

  return NextResponse.json({
    id: heldSale.id,
    createdAt: heldSale.createdAt.toISOString(),
  });
}
