import { prisma } from '@/lib/prisma';

const CHECKOUT_REQUIRED_COLUMNS: Record<string, string[]> = {
  sales: ['id', 'branchId', 'cashierId', 'customerId', 'customerName', 'customerPhone', 'customerPin', 'customerTin', 'subtotal', 'discountAmount', 'totalAmount', 'paymentMethod', 'paymentStatus', 'amountPaid', 'changeAmount', 'notes', 'idempotencyKey', 'createdAt', 'updatedAt'],
  sale_items: ['id', 'saleId', 'productId', 'productName', 'sku', 'quantity', 'unitPrice', 'discount', 'total', 'notes', 'createdAt'],
  payments: ['id', 'saleId', 'method', 'amount', 'status', 'reference', 'createdAt'],
  inventories: ['id', 'branchId', 'productId', 'quantity', 'reserved', 'createdAt', 'updatedAt'],
  stock_movements: ['id', 'inventoryId', 'type', 'quantity', 'reference', 'referenceNumber', 'notes', 'createdAt', 'createdById'],
  branch_settings: ['id', 'branchId', 'receiptPrefix', 'receiptNextNum', 'receiptTemplate', 'currency', 'currencySymbol', 'footerText', 'shopName', 'kraPin', 'createdAt', 'updatedAt'],
  receipts: ['id', 'saleId', 'receiptNo', 'branchId', 'status', 'printedAt', 'reprintedAt', 'voidedAt', 'createdAt'],
};

export async function validateCheckoutDatabaseSchema(): Promise<{ valid: boolean; missingColumns: Array<{ table: string; column: string }> }> {
  const missingColumns: Array<{ table: string; column: string }> = [];

  for (const [table, requiredColumns] of Object.entries(CHECKOUT_REQUIRED_COLUMNS)) {
    try {
      const columnsResult = await prisma.$queryRaw<
        { column_name: string }[]
      >`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = ${table}
        ORDER BY ordinal_position;
      `;

      const existingColumns = new Set(columnsResult.map(c => c.column_name));

      for (const column of requiredColumns) {
        if (!existingColumns.has(column)) {
          missingColumns.push({ table, column });
        }
      }
    } catch {
      missingColumns.push({ table, column: 'TABLE_NOT_FOUND' });
    }
  }

  return {
    valid: missingColumns.length === 0,
    missingColumns,
  };
}
