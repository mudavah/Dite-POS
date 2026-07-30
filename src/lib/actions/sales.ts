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
  const { branchId, cashierId, items, customerId, customerName, customerPhone, customerPin, customerTin, paymentMethod, amountPaid, changeAmount, notes, idempotencyKey } = data;

  if (!items || items.length === 0) {
    throw new CheckoutError('CHECKOUT_VALIDATION_ERROR', 'Sale must contain at least one item', 400);
  }

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
    idempotencyKey,
  });

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) {
            throw new CheckoutError('CHECKOUT_PRODUCT_NOT_FOUND', `Product not found: ${item.productId}`, 404, { productId: item.productId });
          }
        }

        for (const item of items) {
          const inventory = await tx.inventory.findFirst({
            where: { branchId, productId: item.productId },
          });

          if (inventory && inventory.quantity < item.quantity) {
            throw new CheckoutStockError(
              item.productName || item.sku || '',
              item.productId,
              inventory.quantity,
              item.quantity
            );
          }
        }

        const sale = await tx.sale.create({
          data: {
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
            idempotencyKey,
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
        });

        await tx.payment.create({
          data: {
            saleId: sale.id,
            method: paymentMethod,
            amount: totalAmount,
            status: 'COMPLETED',
            reference: '',
          },
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
                item.productName || item.sku || '',
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
      }
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

    const prismaError = error as { code?: string; meta?: { target?: string; cause?: { message?: string } }; message?: string } | undefined;
    if (prismaError?.code === 'P2002') {
      const field = prismaError.meta?.target;
      logger.error('createSale: unique constraint violation', error, { field, durationMs: duration, idempotencyKey });
      let duplicateSaleId: string | undefined;
      let duplicateReceiptNo: string | undefined;
      if (idempotencyKey) {
        try {
          const existingSale = await prisma.sale.findFirst({
            where: { idempotencyKey },
            include: { receipts: true },
          });
          if (existingSale) {
            duplicateSaleId = existingSale.id;
            duplicateReceiptNo = existingSale.receipts[0]?.receiptNo;
          }
        } catch (lookupError) {
          logger.error('createSale: duplicate lookup failed', lookupError, { idempotencyKey, durationMs: duration });
        }
      }
      throw new CheckoutError('CHECKOUT_DUPLICATE', `Duplicate entry for field: ${field}. This sale may have already been processed.`, 409, { field, saleId: duplicateSaleId, receiptNo: duplicateReceiptNo });
    }

    if (prismaError?.code === 'P2003') {
      logger.error('createSale: foreign key violation', error, { durationMs: duration });
      throw new CheckoutError('CHECKOUT_FOREIGN_KEY', 'A referenced record was not found', 400);
    }

    if (prismaError?.code === 'P2022') {
      const missingColumn = prismaError.meta?.target;
      logger.error('createSale: missing database column', error, { missingColumn, durationMs: duration, branchId, cashierId, itemCount: items.length });
      throw new CheckoutError('CHECKOUT_DATABASE', `Database column '${missingColumn}' is missing. Please contact support to sync the database schema.`, 500, { prismaCode: 'P2022', field: missingColumn });
    }

    if (prismaError?.code === 'P2024') {
      logger.error('createSale: transaction timeout', error, { durationMs: duration });
      throw new CheckoutError('CHECKOUT_TIMEOUT', 'Transaction timed out. Please try again.', 504);
    }

    if (prismaError?.code === 'P2025') {
      logger.error('createSale: record not found', error, { durationMs: duration, message: prismaError.message });
      throw new CheckoutError('CHECKOUT_NOT_FOUND', prismaError.message || 'A required record was not found', 404);
    }

    if (prismaError?.code === 'P2034') {
      logger.error('createSale: transaction deadlock', error, { durationMs: duration });
      throw new CheckoutError('CHECKOUT_DEADLOCK', 'Transaction conflict, please retry', 409);
    }

    if (prismaError?.code && prismaError.code.startsWith('P')) {
      logger.error('createSale: prisma error', error, { code: prismaError.code, message: prismaError.message, durationMs: duration, branchId, cashierId, itemCount: items.length, errorType: error instanceof Error ? error.constructor.name : typeof error });
      throw new CheckoutError('CHECKOUT_DATABASE', `Database error: ${prismaError.message || prismaError.code}`, 500, { prismaCode: prismaError.code, field: prismaError.meta?.target as string | undefined });
    }

    logger.error('createSale: unexpected error', error, { durationMs: duration, branchId, cashierId, itemCount: items.length, errorType: error instanceof Error ? error.constructor.name : typeof error, errorMessage: error instanceof Error ? error.message : String(error) });
    throw new CheckoutError('CHECKOUT_UNKNOWN', error instanceof Error ? error.message : 'Unknown error', 500);
  }
}

async function productNameById(tx: Parameters<typeof prisma.$transaction>[0] extends (tx: infer T) => unknown ? T : never, productId: string, inventory: { quantity: number }): Promise<string> {
  const product = await tx.product.findUnique({ where: { id: productId }, select: { name: true } });
  return product?.name || 'Unknown product';
}
