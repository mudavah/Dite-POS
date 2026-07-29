import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSale } from '@/lib/actions/sales';
import { saleSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { CheckoutError } from '@/lib/checkout-errors';
import { prisma } from '@/lib/prisma';

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const session = await auth();

  if (!session?.user) {
    logger.warn('checkout: unauthorized', { requestId, ip: request.headers.get('x-forwarded-for') });
    return NextResponse.json({ error: 'Unauthorized', code: 'CHECKOUT_UNAUTHORIZED' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logger.error('checkout: invalid JSON', { requestId });
    return NextResponse.json({ error: 'Invalid request body', code: 'CHECKOUT_VALIDATION_ERROR' }, { status: 400 });
  }

  const validated = saleSchema.safeParse(body);
  if (!validated.success) {
    logger.warn('checkout: validation failed', { requestId, errors: validated.error.flatten() });
    return NextResponse.json({ error: validated.error.flatten(), code: 'CHECKOUT_VALIDATION_ERROR' }, { status: 400 });
  }

  const branchId = session.user.branchId as string;
  const cashierId = session.user.id;

  if (!branchId) {
    logger.warn('checkout: no branch assigned', { requestId, userId: session.user.id });
    return NextResponse.json({ error: 'User is not assigned to a branch', code: 'CHECKOUT_BRANCH_NOT_FOUND' }, { status: 400 });
  }

  const idempotencyKey = validated.data.idempotencyKey || crypto.randomUUID();

  logger.info('checkout: starting', {
    requestId,
    idempotencyKey,
    cashierId,
    branchId,
    paymentMethod: validated.data.paymentMethod,
    totalAmount: validated.data.totalAmount,
    itemCount: validated.data.items.length,
  });

  try {
    const existingSale = await prisma.sale.findUnique({
      where: { idempotencyKey },
      include: { items: true, receipts: true },
    });

    if (existingSale) {
      const existingReceipt = existingSale.receipts[0];
      logger.info('checkout: idempotency hit - returning existing sale', {
        requestId,
        idempotencyKey,
        existingSaleId: existingSale.id,
        existingReceiptNo: existingReceipt?.receiptNo,
      });

      return NextResponse.json({
        id: existingSale.id,
        receiptNo: existingReceipt?.receiptNo || '',
        totalAmount: existingSale.totalAmount.toNumber(),
        changeAmount: existingSale.changeAmount.toNumber(),
        duplicate: true,
      });
    }

    const result = await createSale(
      { ...validated.data, branchId, cashierId, idempotencyKey },
      undefined
    );

    const duration = Date.now() - startTime;
    logger.info('checkout: success', {
      requestId,
      saleId: result.sale.id,
      receiptNo: result.receiptNo,
      idempotencyKey,
      totalAmount: result.sale.totalAmount.toNumber(),
      durationMs: duration,
      paymentMethod: validated.data.paymentMethod,
    });

    return NextResponse.json({
      id: result.sale.id,
      receiptNo: result.receiptNo,
      totalAmount: result.sale.totalAmount.toNumber(),
      changeAmount: result.sale.changeAmount.toNumber(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof CheckoutError) {
      if (error.code === 'CHECKOUT_DUPLICATE' || error.code === 'CHECKOUT_DUPLICATE_SALE') {
        logger.error('checkout: duplicate detected', error, {
          requestId,
          idempotencyKey,
          code: error.code,
          field: error.details?.field,
          durationMs: duration,
          stack: error.stack,
        });
      } else {
        logger.error('checkout: business error', error, { requestId, idempotencyKey, code: error.code, statusCode: error.statusCode, durationMs: duration });
      }
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.statusCode }
      );
    }

    logger.error('checkout: unexpected error', error, { requestId, idempotencyKey, durationMs: duration, stack: error instanceof Error ? error.stack : undefined });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed', code: 'CHECKOUT_UNKNOWN' },
      { status: 500 }
    );
  }
}