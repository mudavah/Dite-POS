import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/actions/audit';
import { revalidatePath } from 'next/cache';
import { StockMovementType } from '@prisma/client';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId') || '';
  const branchId = searchParams.get('branchId') || '';
  const type = searchParams.get('type') || '';
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (productId) where.productId = productId;
  if (branchId) where.branchId = branchId;
  if (type) where.type = type;

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        inventory: {
          select: {
            product: { select: { name: true, sku: true, costPrice: true, price: true } },
            branch: { select: { name: true } },
          },
        },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return NextResponse.json({
    movements: movements.map((m) => ({
      ...m,
      quantity: m.quantity,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { inventoryId, type, quantity, referenceNumber, notes } = body as {
    inventoryId: string;
    type: string;
    quantity: number;
    referenceNumber?: string;
    notes?: string;
  };

  const inventory = await prisma.inventory.findUnique({
    where: { id: inventoryId },
    include: { product: true },
  });

  if (!inventory) {
    return NextResponse.json({ error: 'Inventory not found' }, { status: 404 });
  }

  if (!Object.values(StockMovementType).includes(type as StockMovementType)) {
    return NextResponse.json({ error: 'Invalid movement type' }, { status: 400 });
  }

  const movement = await prisma.$transaction(async (tx) => {
    const newMovement = await tx.stockMovement.create({
      data: {
        inventoryId,
        type: type as StockMovementType,
        quantity,
        reference: (referenceNumber as string) || undefined,
        notes: (notes as string) || undefined,
        createdById: session.user!.id,
      },
    });

    await tx.inventory.update({
      where: { id: inventoryId },
      data: { quantity: { increment: quantity } },
    });

    await tx.inventoryTransaction.create({
      data: {
        inventoryId,
        productId: inventory.productId,
        branchId: inventory.branchId,
        type: type as StockMovementType,
        quantity,
        previousStock: inventory.quantity,
        newStock: inventory.quantity + quantity,
        referenceNumber: referenceNumber || newMovement.id,
        notes,
        createdById: session.user!.id,
      },
    });

    await auditLog({
      userId: session.user!.id,
      action: 'STOCK_MOVEMENT',
      entity: 'StockMovement',
      entityId: newMovement.id,
      newValues: JSON.stringify({ type, quantity, inventoryId }),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    return newMovement;
  });

  revalidatePath('/inventory');
  revalidatePath('/stock-movements');

  return NextResponse.json(movement, { status: 201 });
}