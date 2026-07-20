import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { branchSchema } from '@/lib/validators';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { users: true, inventories: true } },
      sales: {
        where: { createdAt: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) }, paymentStatus: 'COMPLETED' },
        select: { totalAmount: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(
    branches.map((b) => ({
      ...b,
      monthlySales: b.sales.reduce((sum, s) => sum + s.totalAmount.toNumber(), 0),
      saleCount: b.sales.length,
    }))
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const validated = branchSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json({ error: validated.error.flatten() }, { status: 400 });
  }

  const branch = await prisma.branch.create({
    data: validated.data,
  });

  await prisma.branchSetting.create({
    data: { branchId: branch.id },
  });

  return NextResponse.json(branch);
}
