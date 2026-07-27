import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const formatType = searchParams.get('format') || 'csv';
  const search = searchParams.get('search') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const status = searchParams.get('status') || '';

  const where: Record<string, unknown> = { isArchived: false };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (categoryId) where.categoryId = categoryId;
  if (status === 'active') where.isActive = true;
  else if (status === 'inactive') where.isActive = false;

  const products = await prisma.product.findMany({
    where,
    include: {
      category: { select: { name: true } },
      inventories: { select: { quantity: true, branch: { select: { name: true } } } },
    },
    orderBy: { name: 'asc' },
  });

  const data = products.map((p) => ({
    'Product Name': p.name,
    SKU: p.sku,
    Barcode: p.barcode || '',
    Category: p.category?.name || '',
    Brand: p.brand || '',
    'Buying Price': p.costPrice?.toNumber() || 0,
    'Selling Price': p.price.toNumber(),
    Quantity: p.inventories?.reduce((sum, inv) => sum + inv.quantity, 0) || 0,
    Unit: p.unit,
    'Reorder Level': p.lowStockThreshold,
    Supplier: '',
    Tax: '',
    Description: p.description || '',
  }));

  const headers = Object.keys(data[0] || {});
  const csvRows = [headers.join(',')];
  for (const row of data) {
    csvRows.push(headers.map((h) => `"${(row[h as keyof typeof row] as string)?.replace(/"/g, '""') || ''}"`).join(','));
  }

  if (formatType === 'csv') {
    return new NextResponse(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="products-export-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
      },
    });
  }

  return NextResponse.json({ data, count: data.length });
}