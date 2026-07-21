import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get('branchId') || session.user.branchId || '';
  const search = searchParams.get('search') || '';
  const lowStock = searchParams.get('lowStock') === 'true';

  let where: any = {};
  if (branchId) {
    where.branchId = branchId;
  }

  const inventory = await prisma.inventory.findMany({
    where,
    include: {
      product: { select: { name: true, sku: true, price: true, isActive: true, lowStockThreshold: true, costPrice: true } },
      branch: { select: { name: true, code: true } },
      movements: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  let filtered = inventory;
  if (search) {
    filtered = filtered.filter((inv) =>
      inv.product.name.toLowerCase().includes(search.toLowerCase()) ||
      inv.product.sku.toLowerCase().includes(search.toLowerCase())
    );
  }

  if (lowStock) {
    filtered = filtered.filter((inv) => inv.quantity <= inv.product.lowStockThreshold);
  }

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
  });

  const totalValue = await prisma.inventory.aggregate({
    where: branchId ? { branchId } : undefined,
    _sum: {
      quantity: true,
    },
  });

  const valuation = await prisma.inventory.findMany({
    where: branchId ? { branchId } : undefined,
    include: { product: { select: { costPrice: true, price: true } } },
  });

  const inventoryValue = valuation.reduce((sum, inv) => {
    const cost = inv.product.costPrice?.toNumber() || inv.product.price.toNumber();
    return sum + inv.quantity * cost;
  }, 0);

  return NextResponse.json({
    inventory: filtered.map((inv) => ({
      ...inv,
      product: { ...inv.product, price: inv.product.price.toNumber(), costPrice: inv.product.costPrice?.toNumber() || null },
    })),
    branches,
    summary: {
      totalItems: totalValue._sum.quantity || 0,
      totalValue: inventoryValue,
    },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !['ADMIN', 'CASHIER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { inventoryId, quantity, type, notes, totalStock } = body;

  const inventory = await prisma.inventory.findUnique({
    where: { id: inventoryId },
  });

  if (!inventory) {
    return NextResponse.json({ error: 'Inventory not found' }, { status: 404 });
  }

  if (totalStock !== undefined) {
    await prisma.inventory.update({
      where: { id: inventoryId },
      data: { totalStock },
    });
    return NextResponse.json({ success: true, totalStock });
  }

  const movement = await prisma.stockMovement.create({
    data: {
      inventoryId,
      type,
      quantity,
      notes,
      createdById: session.user.id,
    },
  });

  await prisma.inventory.update({
    where: { id: inventoryId },
    data: { quantity: { increment: quantity } },
  });

  return NextResponse.json(movement);
}
