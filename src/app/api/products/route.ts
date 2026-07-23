import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { productSchema } from '@/lib/validators';
import { sanitizeText } from '@/lib/utils';
import type { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const status = searchParams.get('status') || '';
  const archived = searchParams.get('archived') || 'false';

  const where: Prisma.ProductWhereInput = {
    isArchived: archived === 'true',
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (status === 'active') {
    where.isActive = true;
  } else if (status === 'inactive') {
    where.isActive = false;
  }

  const products = await prisma.product.findMany({
    where,
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  });

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    products: products.map((p) => ({
      ...p,
      price: p.price.toNumber(),
      costPrice: p.costPrice?.toNumber() || null,
    })),
    categories,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const validated = productSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json({ error: validated.error.flatten() }, { status: 400 });
  }

  const sanitized = {
    ...validated.data,
    name: sanitizeText(validated.data.name)!,
    description: sanitizeText(validated.data.description),
    barcode: sanitizeText(validated.data.barcode),
  };

  const product = await prisma.product.create({
    data: sanitized,
  });

  return NextResponse.json({
    ...product,
    price: product.price.toNumber(),
    costPrice: product.costPrice?.toNumber() || null,
  });
}
