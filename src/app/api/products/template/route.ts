import { NextResponse } from 'next/server';
import { format } from 'date-fns';

async function getXLSX() {
  const mod = await import('xlsx');
  return mod;
}

export async function GET(request: Request) {
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
}