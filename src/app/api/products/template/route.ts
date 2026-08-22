import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { format } from 'date-fns';

async function getXLSX() {
  const mod = await import('xlsx');
  return mod;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const XLSX = await getXLSX();
    const headers = [
      'Product Name',
      'SKU',
      'Barcode',
      'Category',
      'Brand',
      'Buying Price',
      'Selling Price',
      'Quantity',
      'Unit',
      'Reorder Level',
      'Supplier',
      'Tax',
      'Description',
    ];

    const exampleRow = [
      'Widget Pro',
      'WDG-PRO-001',
      '1234567890123',
      'Electronics',
      'Acme Corp',
      50.0,
      79.99,
      100,
      'pcs',
      10,
      'Acme Supplies',
      0.16,
      'High quality widget for professional use',
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products Template');

    worksheet['!cols'] = headers.map((_, i) => ({ wch: Math.max(headers[i].length, 15) }));

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="products-template-${format(new Date(), 'yyyy-MM-dd')}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Product template generation failed:', error);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}