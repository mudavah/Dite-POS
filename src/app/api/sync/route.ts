import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createSale } from '@/lib/actions/sales';

export const dynamic = 'force-dynamic';

function isValidUuid(value: string | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ isOnline: true, syncStatus: 'complete', pendingCount: 0, conflictCount: 0, items: [] });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        return NextResponse.json({ error: 'User is not assigned to a branch' }, { status: 400 });
      }

      if (!isValidUuid(item.entityId)) {
        return NextResponse.json({ error: 'Invalid sale reference' }, { status: 400 });
      }

      const existingSale = await prisma.sale.findUnique({
        where: { id: item.entityId },
      });

      if (existingSale) {
        return NextResponse.json({ success: true, message: 'Sale already synced' });
      }

      const items = salePayload.items || [];
      const subtotal = items.reduce((sum: number, item: { unitPrice: number; quantity: number; discount?: number }) => sum + item.unitPrice * item.quantity, 0);
      const discountAmount = items.reduce((sum: number, item: { discount?: number }) => sum + (item.discount || 0), 0);
      const totalAmount = subtotal - discountAmount;

      const saleId = crypto.randomUUID();

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
        },
        saleId
      );

      return NextResponse.json({ success: true, saleId: sale.id, receiptNo });
    }

    return NextResponse.json({ success: true, message: 'Sync item processed' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
