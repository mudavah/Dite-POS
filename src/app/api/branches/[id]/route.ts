import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { branchSchema } from '@/lib/validators';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true, role: true } },
      settings: true,
      printerConfigs: true,
      etrsConfigs: true,
    },
  });

  if (!branch) {
    return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
  }

  return NextResponse.json(branch);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { kraPin, ...branchData } = body;

  const [branch, updatedSetting] = await prisma.$transaction([
    prisma.branch.update({
      where: { id },
      data: branchData,
    }),
    prisma.branchSetting.upsert({
      where: { branchId: id },
      update: { ...(kraPin !== undefined ? { kraPin } : {}) },
      create: { branchId: id, kraPin: kraPin || '' },
    }),
  ]);

  return NextResponse.json({ ...branch, kraPin: updatedSetting.kraPin });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.branch.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
