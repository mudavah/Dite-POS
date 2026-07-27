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
  const brand = searchParams.get('brand') || '';
  const status = searchParams.get('status') || '';

  const where: Record<string, unknown> = { isArchived: false };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
      { brand: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (categoryId) where.categoryId = categoryId;
  if (brand) where.brand = { contains: brand, mode: 'insensitive' };
  if (status === 'active') where.isActive = true;
  else if (status === 'inactive') where.isActive = false;

  const products = await prisma.product.findMany({
    where,
    include: {
      category: { select: { name: true } },
      inventories: { select: { quantity: true } },
    },
    orderBy: { name: 'asc' },
  });

  const data = products.map((p) => {
    const totalStock = p.inventories?.reduce((sum: number, inv: any) => sum + inv.quantity, 0) || 0;
    const costPrice = p.costPrice?.toNumber() || p.price.toNumber();
    const inventoryValue = totalStock * costPrice;

    return {
      'Product Name': p.name,
      SKU: p.sku,
      Barcode: p.barcode || '',
      Category: p.category?.name || '',
      Brand: p.brand || '',
      'Buying Price': costPrice,
      'Selling Price': p.price.toNumber(),
      'Current Stock': totalStock,
      'Inventory Value': inventoryValue,
      'Reorder Level': p.lowStockThreshold,
      Unit: p.unit,
      Tax: p.taxRate.toNumber(),
      Description: p.description || '',
    };
  });

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

  if (formatType === 'xlsx') {
    try {
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="products-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx"`,
        },
      });
    } catch {
      return NextResponse.json({ data, count: data.length });
    }
  }

  return NextResponse.json({ data, count: data.length });
}
