import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { saleSchema } from '@/lib/validators';
import { sanitizeText } from '@/lib/utils';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const validated = saleSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json({ error: validated.error.flatten() }, { status: 400 });
  }

  const branchId = session.user.branchId as string;
  const cashierId = session.user.id;

  if (!branchId) {
    return NextResponse.json({ error: 'User is not assigned to a branch' }, { status: 400 });
  }

  const items = validated.data.items;
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountAmount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
  const totalAmount = subtotal - discountAmount;
  const changeAmount = Math.max(0, validated.data.amountPaid - totalAmount);

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          branchId,
          cashierId,
          customerName: sanitizeText(validated.data.customerName),
          customerPhone: sanitizeText(validated.data.customerPhone),
          subtotal,
          discountAmount,
          totalAmount,
          paymentMethod: validated.data.paymentMethod,
          amountPaid: validated.data.amountPaid,
          changeAmount,
          paymentStatus: 'COMPLETED',
          notes: sanitizeText(validated.data.notes),
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

      const nextNumResult = await tx.$queryRaw<{ next_num: number }[]>`
        UPDATE branch_settings
        SET receipt_next_num = receipt_next_num + 1
        WHERE branch_id = ${branchId}
        RETURNING receipt_next_num AS next_num
      `;
      const nextNum = nextNumResult[0]?.next_num || (settings.receiptNextNum + 1);
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

    return NextResponse.json({
      id: sale.sale.id,
      receiptNo: sale.receiptNo,
      totalAmount,
      changeAmount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 400 }
    );
  }
}
