import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createSale } from '@/lib/actions/sales';
import { logger } from '@/lib/logger';
import { CheckoutError } from '@/lib/checkout-errors';

export const dynamic = 'force-dynamic';

function isValidUuid(value: string | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'CHECKOUT_UNAUTHORIZED' }, { status: 401 });
  }

  return NextResponse.json({ isOnline: true, syncStatus: 'complete', pendingCount: 0, conflictCount: 0, items: [] });
}

export async function POST(request: NextRequest) {
  const requestId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const startTime = Date.now();
  const session = await auth();

  if (!session?.user) {
    logger.warn('sync: unauthorized', { requestId });
    return NextResponse.json({ error: 'Unauthorized', code: 'CHECKOUT_UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const item = body as {
      entityType?: string;
      entityId?: string;
      action?: string;
      payload?: string;
      status?: string;
    };

    if (item.entityType === 'sale' && item.payload) {
      const salePayload = JSON.parse(item.payload);
      const branchId = session.user.branchId as string;
      const cashierId = session.user.id;

      if (!branchId) {
        logger.warn('sync: no branch assigned', { requestId, userId: session.user.id });
        return NextResponse.json({ error: 'User is not assigned to a branch', code: 'CHECKOUT_BRANCH_NOT_FOUND' }, { status: 400 });
      }

      if (!isValidUuid(item.entityId)) {
        logger.warn('sync: invalid sale reference', { requestId, entityId: item.entityId });
        return NextResponse.json({ error: 'Invalid sale reference', code: 'CHECKOUT_VALIDATION_ERROR' }, { status: 400 });
      }

      const existingSale = await prisma.sale.findUnique({
        where: { id: item.entityId },
      });

      if (existingSale) {
        logger.info('sync: duplicate sale detected (already synced)', { requestId, saleId: item.entityId });
        return NextResponse.json({ success: true, message: 'Sale already synced', saleId: existingSale.id, receiptNo: (existingSale as { receiptNo?: string }).receiptNo });
      }

      const idempotencyKey = salePayload.idempotencyKey || item.entityId;

      const existingIdempotency = await prisma.sale.findUnique({
        where: { idempotencyKey },
      });

      if (existingIdempotency) {
        logger.info('sync: idempotency hit - sale already exists', { requestId, idempotencyKey, existingSaleId: existingIdempotency.id });
        const existingReceipt = await prisma.receipt.findUnique({
          where: { saleId: existingIdempotency.id },
        });
        return NextResponse.json({ success: true, message: 'Sale already synced (idempotency)', saleId: existingIdempotency.id, receiptNo: existingReceipt?.receiptNo });
      }

      const items = salePayload.items || [];
      const subtotal = items.reduce((sum: number, item: { unitPrice: number; quantity: number; discount?: number }) => sum + item.unitPrice * item.quantity, 0);
      const discountAmount = items.reduce((sum: number, item: { discount?: number }) => sum + (item.discount || 0), 0);
      const totalAmount = subtotal - discountAmount;

      try {
        const { sale, receiptNo } = await createSale(
          {
            items: items.map((item: { productId: string; productName: string; sku?: string; quantity: number; unitPrice: number; discount?: number; notes?: string }) => ({
              productId: item.productId,
              productName: item.productName,
              sku: item.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: (item.unitPrice * item.quantity) - (item.discount || 0),
              notes: item.notes,
            })),
            paymentMethod: salePayload.paymentMethod,
            amountPaid: salePayload.amountPaid,
            changeAmount: salePayload.changeAmount || 0,
            customerId: salePayload.customerId,
            customerName: salePayload.customerName,
            customerPhone: salePayload.customerPhone,
            notes: salePayload.notes,
            subtotal,
            discountAmount,
            totalAmount,
            branchId,
            cashierId,
            idempotencyKey,
          },
          item.entityId
        );

        const duration = Date.now() - startTime;
        logger.info('sync: sale synced', { requestId, saleId: sale.id, receiptNo, idempotencyKey, durationMs: duration });

        return NextResponse.json({ success: true, saleId: sale.id, receiptNo });
      } catch (saleError) {
        if (saleError instanceof CheckoutError) {
          logger.error('sync: checkout business error', saleError, { requestId, code: saleError.code, saleId: item.entityId, idempotencyKey });
          return NextResponse.json(
            { error: saleError.message, code: saleError.code, details: saleError.details },
            { status: saleError.statusCode }
          );
        }
        throw saleError;
      }
    }

    return NextResponse.json({ success: true, message: 'Sync item processed' });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('sync: unexpected error', error, { requestId, durationMs: duration });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed', code: 'CHECKOUT_UNKNOWN' },
      { status: 500 }
    );
  }
}