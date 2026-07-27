'use server';

import { prisma } from '@/lib/prisma';
import { sanitizeText } from '@/lib/utils';
import { logger } from '@/lib/logger';
import type { SaleInput } from '@/lib/validators';
import { CheckoutError, CheckoutStockError, CheckoutBranchError } from '@/lib/checkout-errors';

export async function createSale(
  data: SaleInput & { branchId: string; cashierId: string },
  explicitId?: string
) {
  const startTime = Date.now();
  const { branchId, cashierId, items, customerId, customerName, customerPhone, customerPin, customerTin, paymentMethod, amountPaid, changeAmount, notes } = data;

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountAmount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
  const totalAmount = subtotal - discountAmount;
  const finalChangeAmount = changeAmount ?? Math.max(0, amountPaid - totalAmount);

  logger.info('createSale: starting', {
    branchId,
    cashierId,
    itemCount: items.length,
    subtotal,
    discountAmount,
    totalAmount,
    paymentMethod,
    explicitId,
  });

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.create({
          data: {
            id: explicitId,
            branchId,
            cashierId,
            customerId,
            customerName: sanitizeText(customerName),
            customerPhone: sanitizeText(customerPhone),
            customerPin: sanitizeText(customerPin),
            customerTin: sanitizeText(customerTin),
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
              throw new CheckoutStockError(
                item.productName || item.sku || 'Unknown product',
                item.productId,
                inventory.quantity,
                item.quantity
              );
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
          throw new CheckoutBranchError(branchId);
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
      },
      { maxWait: 5000, timeout: 10000 }
    );

    const duration = Date.now() - startTime;
    logger.info('createSale: completed', {
      saleId: result.sale.id,
      receiptNo: result.receiptNo,
      durationMs: duration,
      itemCount: items.length,
      totalAmount,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof CheckoutError) {
      logger.error('createSale: checkout error', error, { code: error.code, statusCode: error.statusCode, durationMs: duration });
      throw error;
    }

    const prismaError = error as { code?: string; meta?: { target?: string } } | undefined;
    if (prismaError?.code === 'P2002') {
      const field = prismaError.meta?.target;
      logger.error('createSale: unique constraint violation', error, { field, durationMs: duration });
      throw new CheckoutError('CHECKOUT_DUPLICATE', `Duplicate entry for field: ${field}`, 409, { field });
    }

    if (prismaError?.code === 'P2003') {
      logger.error('createSale: foreign key violation', error, { durationMs: duration });
      throw new CheckoutError('CHECKOUT_FOREIGN_KEY', 'A referenced record was not found', 409);
    }

    if (prismaError?.code === 'P2034') {
      logger.error('createSale: transaction deadlock', error, { durationMs: duration });
      throw new CheckoutError('CHECKOUT_DEADLOCK', 'Transaction conflict, please retry', 409);
    }

    logger.error('createSale: unexpected error', error, { durationMs: duration, branchId, cashierId, itemCount: items.length });
    throw new CheckoutError('CHECKOUT_UNKNOWN', error instanceof Error ? error.message : 'Unknown error', 500);
  }
}
