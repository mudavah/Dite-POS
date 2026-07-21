import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const configs = await prisma.printerConfig.findMany({
    where: session.user.branchId ? { branchId: session.user.branchId } : undefined,
    include: { branch: { select: { name: true, code: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(configs);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { branchId, name, type, protocol, paperSize, vendorId, productId, endpoint, deviceId, isDefault, isActive } = body;

  if (!branchId || !name) {
    return NextResponse.json({ error: 'Branch and name are required' }, { status: 400 });
  }

  const config = await prisma.printerConfig.create({
    data: {
      branchId,
      name,
      type: type || 'USB',
      protocol: protocol || 'ESC_POS',
      paperSize: paperSize || '80mm',
      vendorId: vendorId || null,
      productId: productId || null,
      endpoint: endpoint || null,
      deviceId: deviceId || null,
      isDefault: isDefault || false,
      isActive: isActive ?? true,
    },
  });

  return NextResponse.json(config, { status: 201 });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, branchId, name, type, protocol, paperSize, vendorId, productId, endpoint, deviceId, isDefault, isActive } = body;

  if (!id) {
    return NextResponse.json({ error: 'Printer config ID is required' }, { status: 400 });
  }

  const config = await prisma.printerConfig.update({
    where: { id },
    data: {
      branchId,
      name,
      type,
      protocol,
      paperSize,
      vendorId: vendorId || null,
      productId: productId || null,
      endpoint: endpoint || null,
      deviceId: deviceId || null,
      isDefault,
      isActive,
    },
  });

  return NextResponse.json(config);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Printer config ID is required' }, { status: 400 });
  }

  await prisma.printerConfig.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
