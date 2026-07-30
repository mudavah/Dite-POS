import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createSale } from '@/lib/actions/sales';
import { logger } from '@/lib/logger';
import { CheckoutError } from '@/lib/checkout-errors';
import { z } from 'zod';

const syncItemSchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  action: z.string().optional(),
  payload: z.any().optional(),
  status: z.string().optional(),
});

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
    const syncValidated = syncItemSchema.safeParse(body);
    if (!syncValidated.success) {
      return NextResponse.json({ error: syncValidated.error.flatten(), code: 'CHECKOUT_VALIDATION_ERROR' }, { status: 400 });
    }

    const item = syncValidated.data;

    if (item.entityType === 'sale' && item.payload) {
      const salePayload = z.object({
        idempotencyKey: z.string().uuid().optional(),
        items: z.array(z.object({
          productId: z.string(),
          productName: z.string().optional().nullable(),
          sku: z.string().optional().nullable(),
          quantity: z.coerce.number().int().positive(),
          unitPrice: z.coerce.number().positive(),
          discount: z.coerce.number().nonnegative().default(0),
          notes: z.string().optional().nullable(),
        })).min(1),
        paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'SPLIT', 'CREDIT']),
        amountPaid: z.coerce.number().nonnegative(),
        changeAmount: z.coerce.number().nonnegative().optional(),
        customerId: z.string().optional().nullable(),
        customerName: z.string().optional().nullable(),
        customerPhone: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        subtotal: z.coerce.number().nonnegative().optional(),
        discountAmount: z.coerce.number().nonnegative().optional(),
        totalAmount: z.coerce.number().nonnegative().optional(),
      }).safeParse(item.payload);

      if (!salePayload.success) {
        return NextResponse.json({ error: salePayload.error.flatten(), code: 'CHECKOUT_VALIDATION_ERROR' }, { status: 400 });
      }

      const salePayloadData = salePayload.data;
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
        where: { id: item.entityId! },
      });

      if (existingSale) {
        logger.info('sync: duplicate sale detected (already synced by entityId)', { requestId, saleId: item.entityId, reason: 'A sale with the same entityId already exists in the database. This prevents re-uploading an already-synced offline sale.' });
        return NextResponse.json({ success: true, message: 'Sale already synced', saleId: existingSale.id, receiptNo: (existingSale as { receiptNo?: string }).receiptNo, duplicateReason: 'Already synced by entityId' });
      }

      const idempotencyKey = salePayloadData.idempotencyKey || item.entityId!;

      const existingIdempotency = await prisma.sale.findFirst({
        where: { idempotencyKey, paymentStatus: 'COMPLETED' },
      });

      if (existingIdempotency) {
        logger.info('sync: idempotency hit - sale already exists', { requestId, idempotencyKey, existingSaleId: existingIdempotency.id, existingPaymentStatus: existingIdempotency.paymentStatus, reason: 'The sale payload contains an idempotencyKey that matches an existing completed sale. Returning the original sale data without creating a duplicate.' });
        const existingReceipt = await prisma.receipt.findUnique({
          where: { saleId: existingIdempotency.id },
        });
        return NextResponse.json({ success: true, message: 'Sale already synced (idempotency)', saleId: existingIdempotency.id, receiptNo: existingReceipt?.receiptNo, duplicateReason: 'Idempotency key match' });
      }

      const items = salePayloadData.items || [];
      const subtotal = items.reduce((sum: number, item: { unitPrice: number; quantity: number; discount?: number }) => sum + item.unitPrice * item.quantity, 0);
      const discountAmount = items.reduce((sum: number, item: { discount?: number }) => sum + (item.discount || 0), 0);
      const totalAmount = subtotal - discountAmount;

      try {
        const { sale, receiptNo } = await createSale(
          {
            items: items.map((item: { productId: string; productName?: string | null; sku?: string | null; quantity: number; unitPrice: number; discount?: number; notes?: string | null }) => ({
              productId: item.productId,
              productName: item.productName || '',
              sku: item.sku || undefined,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: (item.unitPrice * item.quantity) - (item.discount || 0),
              notes: item.notes || undefined,
            })),
            paymentMethod: salePayloadData.paymentMethod,
            amountPaid: salePayloadData.amountPaid,
            changeAmount: salePayloadData.changeAmount || 0,
            customerId: salePayloadData.customerId,
            customerName: salePayloadData.customerName,
            customerPhone: salePayloadData.customerPhone,
            notes: salePayloadData.notes,
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