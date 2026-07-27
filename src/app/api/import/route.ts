import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/actions/audit';
import { revalidatePath } from 'next/cache';
import { Product } from '@prisma/client';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const overwrite = formData.get('overwrite') === 'true';
  const skipDuplicates = formData.get('skipDuplicates') !== 'false';

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split('.').pop()?.toLowerCase();

  let rows: any[] = [];

  if (ext === 'csv') {
    const text = buffer.toString('utf-8');
    const lines = text.split('\n').filter((l) => l.trim());
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = values[idx]?.trim(); });
      rows.push(row);
    }
  } else if (ext === 'xlsx' || ext === 'xls') {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet);
    } catch {
      return NextResponse.json({ error: 'Excel file processing requires the xlsx package. Please use CSV format instead.' }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: 'Unsupported file format' }, { status: 400 });
  }

  const errors: any[] = [];
  const imported: any[] = [];
  const skipped: any[] = [];
  const duplicates: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    if (!row.productname && !row.name) {
      errors.push({ row: rowNum, error: 'Product name is required' });
      continue;
    }

    const productName = row.productname || row.name;
    const sku = row.sku || row.productcode || '';
    const barcode = row.barcode || row.ean || row.upc || '';

    if (sku) {
      const existing = await prisma.product.findUnique({ where: { sku } });
      if (existing) {
        if (skipDuplicates) {
          duplicates.push({ row: rowNum, sku, productName, reason: 'Duplicate SKU' });
          continue;
        } else if (!overwrite) {
          skipped.push({ row: rowNum, sku, productName, reason: 'SKU exists, not overwriting' });
          continue;
        } else {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: productName,
              barcode: barcode || existing.barcode,
              description: row.description || existing.description,
              price: row.sellingprice ? parseFloat(row.sellingprice) : existing.price,
              costPrice: row.buyingprice ? parseFloat(row.buyingprice) : existing.costPrice,
              lowStockThreshold: row.reorderlevel ? parseInt(row.reorderlevel) : existing.lowStockThreshold,
              brand: row.brand || existing.brand,
              unit: row.unit || existing.unit,
            },
          });
          imported.push({ row: rowNum, sku, productName, action: 'updated' });
          continue;
        }
      }
    }

    let category: any = null;
    if (row.category) {
      category = await prisma.category.upsert({
        // @ts-ignore
        where: { name: String(row.category) },
        update: {},
        create: { name: String(row.category) },
      });
    }

    let supplier: any = null;
    if (row.supplier) {
      supplier = await prisma.supplier.upsert({
        // @ts-ignore
        where: { name: String(row.supplier) },
        update: {},
        create: { name: String(row.supplier), status: 'ACTIVE' },
      });
    }

    const product = await prisma.product.create({
      data: {
        name: productName,
        sku: sku || `AUTO-${Date.now()}-${i}`,
        barcode: barcode || undefined,
        description: row.description || undefined,
        price: row.sellingprice ? parseFloat(row.sellingprice) : 0,
        costPrice: row.buyingprice ? parseFloat(row.buyingprice) : 0,
        categoryId: category?.id || undefined,
        lowStockThreshold: row.reorderlevel ? parseInt(row.reorderlevel) : 10,
        brand: row.brand || undefined,
        unit: row.unit || 'pcs',
        isActive: true,
      },
    });

    if (supplier) {
      await prisma.purchaseItem.create({
        data: {
          productId: product.id,
          productName: productName,
          sku: sku || '',
          barcode: barcode || undefined,
          quantity: row.quantity ? parseInt(row.quantity) : 0,
          buyingPrice: row.buyingprice ? parseFloat(row.buyingprice) : 0,
          sellingPrice: row.sellingprice ? parseFloat(row.sellingprice) : 0,
          lineTotal: (row.quantity ? parseInt(row.quantity) : 0) * (row.buyingprice ? parseFloat(row.buyingprice) : 0),
        } as any,
      });
    }

    imported.push({ row: rowNum, sku: product.sku, productName, action: 'created' });
  }

  await auditLog({
    userId: session.user.id,
    action: 'EXCEL_IMPORT',
    entity: 'Product',
    newValues: JSON.stringify({ imported: imported.length, errors: errors.length, duplicates: duplicates.length, skipped: skipped.length }),
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
  });

  revalidatePath('/products');

  return NextResponse.json({
    imported,
    errors,
    duplicates,
    skipped,
    summary: {
      imported: imported.length,
      errors: errors.length,
      duplicates: duplicates.length,
      skipped: skipped.length,
      totalRows: rows.length,
    },
  });
}