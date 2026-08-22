import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Product, Category, Supplier } from '@prisma/client';
import { auditLog } from '@/lib/actions/audit';
import { revalidatePath } from 'next/cache';
import { importRowSchema, ImportRowInput } from '@/lib/validators';
import { StockMovementType } from '@prisma/client';
import { sanitizeText } from '@/lib/utils';

interface ExcelRow {
  [key: string]: string | number | undefined;
}

function parseExcelFile(buffer: Buffer, ext: string): ExcelRow[] {
  if (ext === 'csv') {
    const text = buffer.toString('utf-8');
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    const rows: ExcelRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row: ExcelRow = {};
      headers.forEach((h, idx) => { row[h] = values[idx]?.trim(); });
      rows.push(row);
    }
    return rows;
  }

  if (ext === 'xlsx' || ext === 'xls') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet) as ExcelRow[];
  }

  return [];
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const mode = formData.get('mode') || 'skip';

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
    return NextResponse.json({ error: 'Unsupported file format. Use .xlsx, .xls, or .csv' }, { status: 400 });
  }

  const rows = parseExcelFile(buffer, ext || 'csv');

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No data rows found in file' }, { status: 400 });
  }

  const validationResults: Array<{ row: number; data: ImportRowInput; errors: string[]; warnings: string[] }> = [];
  const errors: Array<{ row: number; errors: string[]; productName: string }> = [];
  const duplicates: Array<{ row: number; sku: string; productName: string; reason: string }> = [];
  const warnings: Array<{ row: number; warnings: string[] }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const rowErrors: string[] = [];
    const rowWarnings: string[] = [];

    const productName = String(row.productname || row.name || row.ProductName || row.Name || '');
    const sku = String(row.sku || row.productcode || row.SKU || row.ProductCode || '');
    const barcode = String(row.barcode || row.ean || row.upc || row.Barcode || row.EAN || '');

    if (!productName) {
      rowErrors.push('Product name is required');
    }

    if (sku && sku.length > 50) {
      rowErrors.push('SKU must be 50 characters or less');
    }

    if (barcode && barcode.length > 100) {
      rowErrors.push('Barcode must be 100 characters or less');
    }

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, errors: rowErrors, productName: productName || `Row ${rowNum}` });
      continue;
    }

    const parseNumber = (val: string | number | undefined, fieldName: string): number | null => {
      if (val === undefined || val === null || val === '') return null;
      const num = parseFloat(String(val).replace(/[,₹$]/g, '').trim());
      if (isNaN(num)) {
        rowErrors.push(`${fieldName} must be a valid number`);
        return null;
      }
      return num;
    };

    const buyingPrice = parseNumber(row.buyingprice || row.BuyingPrice || row.costprice || row.CostPrice, 'Buying Price');
    const sellingPrice = parseNumber(row.sellingprice || row.SellingPrice || row.price || row.Price, 'Selling Price');
    const quantity = parseInt(String(row.quantity || row.Quantity || row.qty || row.Qty || 0));
    const reorderLevel = parseInt(String(row.reorderlevel || row.ReorderLevel || row.reorderlevel || 10));
    const tax = parseNumber(row.tax || row.Tax || 0, 'Tax');

    if (buyingPrice !== null && buyingPrice < 0) rowErrors.push('Buying Price cannot be negative');
    if (sellingPrice !== null && sellingPrice < 0) rowErrors.push('Selling Price cannot be negative');
    if (quantity < 0) rowErrors.push('Quantity cannot be negative');
    if (reorderLevel < 0) rowErrors.push('Reorder Level cannot be negative');

    if (sku) {
      const existingBySku = await prisma.product.findUnique({ where: { sku } });
      if (existingBySku) {
        if (mode === 'skip') {
          duplicates.push({ row: rowNum, sku, productName, reason: 'Duplicate SKU, skipping' });
          continue;
        } else if (mode === 'update') {
          rowWarnings.push(`SKU exists, will update product`);
        } else if (mode === 'merge') {
          rowWarnings.push(`SKU exists, will merge inventory`);
        }
      }
    }

    if (barcode) {
      const existingByBarcode = await prisma.product.findUnique({ where: { barcode } });
      if (existingByBarcode && (!sku || existingByBarcode.sku !== sku)) {
        rowWarnings.push(`Barcode already exists for product "${existingByBarcode.name}"`);
      }
    }

    const validated = importRowSchema.safeParse({
      productName,
      sku,
      barcode,
      category: row.category || row.Category || '',
      brand: row.brand || row.Brand || '',
      buyingPrice: buyingPrice || 0,
      sellingPrice: sellingPrice || 0,
      quantity: isNaN(quantity) ? 0 : quantity,
      unit: row.unit || row.Unit || 'pcs',
      reorderLevel: isNaN(reorderLevel) ? 10 : reorderLevel,
      supplier: row.supplier || row.Supplier || '',
      tax: tax !== null ? tax : 0,
      description: row.description || row.Description || '',
    });

    if (!validated.success) {
      rowErrors.push(...(validated.error?.issues?.map((e) => e.message) || []));
    }

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, errors: rowErrors, productName: productName });
      continue;
    }

    validationResults.push({
      row: rowNum,
      data: validated.data as ImportRowInput,
      errors: rowErrors,
      warnings: rowWarnings,
    });
  }

  const hasErrors = errors.length > 0 && errors.every((e) => e.row !== -1);
  if (validationResults.length === 0) {
    return NextResponse.json({
      preview: rows,
      summary: { totalRows: rows.length, validRows: 0, errorRows: errors.length, duplicates: duplicates.length },
      errors,
      duplicates,
      warnings,
    });
  }

  return NextResponse.json({
    preview: validationResults.map((vr) => ({ row: vr.row, data: vr.data, warnings: vr.warnings })),
    summary: { totalRows: rows.length, validRows: validationResults.length, errorRows: errors.length, duplicates: duplicates.length },
    errors,
    duplicates,
    warnings,
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { rows, mode, fileName } = body as { rows: any[]; mode: string; fileName: string };

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
  }

  const importLog = await prisma.importLog.create({
    data: {
      userId: session.user!.id,
      fileName,
      totalRows: rows.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      duplicates: 0,
      errors: '[]',
      status: 'IMPORTING',
    },
  });

  const result = await prisma.$transaction(async (tx) => {
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const importErrors: Array<{ row: number; error: string }> = [];

    for (const row of rows) {
      try {
        const sku = row.data.sku || '';
        const productName = row.data.productName;
        const barcode = row.data.barcode || undefined;

        let product = null;

        if (sku) {
          product = await tx.product.findUnique({ where: { sku } });
        }

        if (!product && barcode) {
          product = await tx.product.findUnique({ where: { barcode } });
        }

        if (product) {
          if (mode === 'skip') {
            skipped++;
            continue;
          } else if (mode === 'update') {
            await tx.product.update({
              where: { id: product.id },
              data: {
                name: sanitizeText(productName) || productName,
                barcode: barcode || product.barcode,
                description: row.data.description || undefined,
                price: row.data.sellingPrice || product.price,
                costPrice: row.data.buyingPrice || product.costPrice,
                brand: sanitizeText(row.data.brand) || product.brand,
                unit: row.data.unit || product.unit,
                lowStockThreshold: row.data.reorderLevel || product.lowStockThreshold,
                taxRate: row.data.tax || product.taxRate,
                discount: row.data.discount || product.discount,
              },
            });
            updated++;
            continue;
          } else if (mode === 'merge' && product) {
            let inventory = await tx.inventory.findUnique({
              where: { branchId_productId: { branchId: session.user!.branchId as string, productId: product.id } },
            });

            if (!inventory) {
              inventory = await tx.inventory.create({
                data: {
                  branchId: session.user!.branchId as string,
                  productId: product.id,
                  quantity: row.data.quantity || 0,
                },
              });
            } else {
              await tx.inventory.update({
                where: { id: inventory.id },
                data: { quantity: { increment: row.data.quantity || 0 } },
              });
            }

            await tx.stockMovement.create({
              data: {
                inventoryId: inventory.id,
                type: StockMovementType.OPENING_STOCK,
                quantity: row.data.quantity || 0,
                reference: 'Excel Import',
                notes: `Merged inventory for ${productName} from import`,
                createdById: session.user!.id,
              },
            });

            await tx.inventoryTransaction.create({
              data: {
                inventoryId: inventory.id,
                productId: product.id,
                branchId: session.user!.branchId as string,
                type: StockMovementType.OPENING_STOCK,
                quantity: row.data.quantity || 0,
                previousStock: inventory.quantity - (row.data.quantity || 0),
                newStock: inventory.quantity,
                referenceNumber: 'IMPORT',
                notes: `Merged inventory from import`,
                createdById: session.user!.id,
              },
            });

            updated++;
            continue;
          }
        }

        let category: Category | null = null;
         if (row.data.category) {
           category = await tx.category.findFirst({ where: { name: String(row.data.category) } });
           if (!category) {
             category = await tx.category.create({ data: { name: String(row.data.category), isActive: true } });
           }
         }

         let supplier: Supplier | null = null;
         if (row.data.supplier) {
           supplier = await tx.supplier.findFirst({ where: { name: String(row.data.supplier) } });
           if (!supplier) {
             supplier = await tx.supplier.create({ data: { name: String(row.data.supplier), status: 'ACTIVE' } });
           }
         }

        const newProduct = await tx.product.create({
          data: {
            name: sanitizeText(productName) || productName,
            sku: sku || `AUTO-${Date.now()}-${imported}`,
            barcode: barcode,
            description: row.data.description || undefined,
            price: row.data.sellingPrice || 0,
            costPrice: row.data.buyingPrice || 0,
            categoryId: category?.id || undefined,
            brand: sanitizeText(row.data.brand) || undefined,
            unit: row.data.unit || 'pcs',
            lowStockThreshold: row.data.reorderLevel || 10,
            maxStock: 1000,
            taxRate: row.data.tax || 0,
            discount: row.data.discount || 0,
            isActive: true,
          },
        });

         if (row.data.quantity && row.data.quantity > 0) {
           let inventory = await tx.inventory.findUnique({
            where: { branchId_productId: { branchId: session.user!.branchId as string, productId: newProduct.id } },
          });

          if (!inventory) {
            inventory = await tx.inventory.create({
              data: {
                branchId: session.user!.branchId as string,
                productId: newProduct.id,
                quantity: row.data.quantity,
              },
            });
          } else {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: { quantity: { increment: row.data.quantity } },
            });
          }

          await tx.stockMovement.create({
            data: {
              inventoryId: inventory.id,
              type: StockMovementType.OPENING_STOCK,
              quantity: row.data.quantity,
              reference: 'Excel Import',
              notes: `Opening stock for ${productName} from import`,
              createdById: session.user!.id,
            },
          });

          await tx.inventoryTransaction.create({
            data: {
              inventoryId: inventory.id,
              productId: newProduct.id,
              branchId: session.user!.branchId as string,
              type: StockMovementType.OPENING_STOCK,
              quantity: row.data.quantity,
              previousStock: inventory.quantity - row.data.quantity,
              newStock: inventory.quantity,
              referenceNumber: 'IMPORT',
              notes: `Opening stock from import`,
              createdById: session.user!.id,
            },
          });
        }

        imported++;
      } catch (err: unknown) {
        failed++;
        importErrors.push({ row: rows.indexOf(row) + 2, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    await tx.importLog.update({
      where: { id: importLog.id },
      data: {
        imported,
        updated,
        skipped,
        failed,
        duplicates: 0,
        errors: JSON.stringify(importErrors),
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    await auditLog({
      userId: session.user!.id,
      action: 'PRODUCT_IMPORT',
      entity: 'Product',
      newValues: JSON.stringify({ imported, updated, skipped, failed, fileName }),
    });

    return { imported, updated, skipped, failed, duplicates: 0, errors: importErrors };
  });

  revalidatePath('/products');
  revalidatePath('/inventory');
  revalidatePath('/dashboard');

  return NextResponse.json({
    ...result,
    importLogId: importLog.id,
  });
}