import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = session.user.role === 'ADMIN';
  const settings = await prisma.branchSetting.findMany({
    where: isAdmin ? {} : { branchId: session.user.branchId as string },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          phone: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json(
    settings.map((s) => ({
      ...s,
      branchAddress: s.branch?.address,
      branchPhone: s.branch?.phone,
      branchEmail: s.branch?.email,
    }))
  );
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { branchId, branchAddress, branchPhone, ...data } = body;

  const [updatedSetting] = await prisma.$transaction([
    prisma.branchSetting.update({
      where: { branchId },
      data,
    }),
    prisma.branch.update({
      where: { id: branchId },
      data: {
        ...(branchAddress !== undefined ? { address: branchAddress } : {}),
        ...(branchPhone !== undefined ? { phone: branchPhone } : {}),
      },
    }),
  ]);

  return NextResponse.json(updatedSetting);
}
