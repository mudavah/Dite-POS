import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toNumeric } from '@/lib/numeric';
import { StockMovementType } from '@prisma/client';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get('branchId') || session.user.branchId || '';
  const search = searchParams.get('search') || '';
  const lowStock = searchParams.get('lowStock') === 'true';
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

  const baseWhere: Record<string, unknown> = {};
  if (branchId) {
    baseWhere.branchId = branchId;
  }
  if (search) {
    baseWhere.product = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const allInventory = await prisma.inventory.findMany({
    where: baseWhere,
    include: {
      product: {
        select: {
          name: true,
          sku: true,
          price: true,
          isActive: true,
          lowStockThreshold: true,
          costPrice: true,
          isArchived: true,
        },
      },
      branch: { select: { name: true, code: true } },
      movements: { take: 5, orderBy: { createdAt: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const totalValue = allInventory.reduce((sum, inv) => {
    const cost = toNumeric(inv.product.costPrice) || toNumeric(inv.product.price) || 0;
    return sum + inv.quantity * cost;
  }, 0);

  const totalProducts = new Set(allInventory.map((inv) => inv.productId)).size;

  const lowStockList = allInventory.filter(
    (inv) => !inv.product.isArchived && inv.quantity <= inv.product.lowStockThreshold
  );
  const outOfStockList = allInventory.filter((inv) => inv.quantity === 0);

  const displayList = lowStock ? lowStockList : allInventory;
  const total = displayList.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const pageItems = displayList.slice(start, start + limit);

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
  });

  return NextResponse.json({
    inventory: pageItems.map((inv) => ({
      ...inv,
      product: {
        ...inv.product,
        price: toNumeric(inv.product.price),
        costPrice: toNumeric(inv.product.costPrice) || null,
      },
    })),
    branches,
    pagination: { total, page, limit, totalPages },
    summary: {
      totalItems: allInventory.reduce((sum, inv) => sum + inv.quantity, 0),
      totalProducts,
      totalValue,
      lowStock: lowStockList.length,
      outOfStock: outOfStockList.length,
    },
  });
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || !['ADMIN', 'CASHIER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { inventoryId, quantity, type, notes } = body as {
      inventoryId: string;
      quantity: number;
      type?: string;
      notes?: string;
    };

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
    });

    if (!inventory) {
      return NextResponse.json({ error: 'Inventory not found' }, { status: 404 });
    }

    const absQuantity = Math.abs(quantity);
    const isDecrement = quantity < 0;
    const updated = await prisma.inventory.updateMany({
      where: {
        id: inventoryId,
        ...(isDecrement ? { quantity: { gte: absQuantity } } : {}),
      },
      data: isDecrement ? { quantity: { decrement: absQuantity } } : { quantity: { increment: absQuantity } },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Insufficient stock for this adjustment' }, { status: 400 });
    }

    const movement = await prisma.stockMovement.create({
      data: {
        inventoryId,
        type: Object.values(StockMovementType).includes(type as StockMovementType)
          ? (type as StockMovementType)
          : StockMovementType.ADJUSTMENT,
        quantity,
        notes,
        createdById: session.user.id,
      },
    });

    return NextResponse.json(movement);
  } catch (error) {
    console.error('Stock adjustment failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to adjust stock';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
