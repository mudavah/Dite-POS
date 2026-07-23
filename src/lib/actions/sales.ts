'use server';

import { prisma } from '@/lib/prisma';
import { sanitizeText } from '@/lib/utils';
import type { SaleInput } from '@/lib/validators';

export async function createSale(
  data: SaleInput & { branchId: string; cashierId: string },
  explicitId?: string
) {
  const { branchId, cashierId, items, customerId, customerName, customerPhone, paymentMethod, amountPaid, changeAmount, notes } = data;

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountAmount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
  const totalAmount = subtotal - discountAmount;
  const finalChangeAmount = changeAmount ?? Math.max(0, amountPaid - totalAmount);

  return await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        id: explicitId,
        branchId,
        cashierId,
        customerId,
        customerName: sanitizeText(customerName),
        customerPhone: sanitizeText(customerPhone),
        subtotal,
        discountAmount,
        totalAmount,
        paymentMethod,
        amountPaid,
        changeAmount: finalChangeAmount,
        paymentStatus: 'COMPLETED',
        notes: sanitizeText(notes),
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            productName: sanitizeText(item.productName) || item.sku || '',
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            total: (item.unitPrice * item.quantity) - (item.discount || 0),
            notes: sanitizeText(item.notes),
          })),
        },
      },
      include: { items: true },
    });

    for (const item of items) {
      const inventory = await tx.inventory.findFirst({
        where: { branchId, productId: item.productId },
      });

      if (inventory) {
        const updated = await tx.inventory.updateMany({
          where: { id: inventory.id, quantity: { gte: item.quantity } },
          data: { quantity: { decrement: item.quantity } },
        });

        if (updated.count === 0) {
          throw new Error(`Insufficient stock for ${item.productName || item.sku}`);
        }

        await tx.stockMovement.create({
          data: {
            inventoryId: inventory.id,
            type: 'SALE',
            quantity: -item.quantity,
            reference: sale.id,
            notes: `Sale ${sale.id}`,
            createdById: cashierId,
          },
        });
      }
    }

    const settings = await tx.branchSetting.findUnique({ where: { branchId } });
    if (!settings) {
      throw new Error('Branch settings not found');
    }

    const updatedSettings = await tx.branchSetting.update({
      where: { branchId },
      data: { receiptNextNum: { increment: 1 } },
    });
    const nextNum = updatedSettings.receiptNextNum;
    const receiptNo = `${settings.receiptPrefix || 'RCP'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(nextNum).padStart(5, '0')}`;

    await tx.receipt.create({
      data: {
        saleId: sale.id,
        receiptNo,
        branchId,
      },
    });

    return { sale, receiptNo };
  });
}
