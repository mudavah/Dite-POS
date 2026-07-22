import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { paymentMethod, amountPaid, changeAmount } = body;

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { items: true, branch: true },
  });

  if (!sale) {
    return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
  }

  if (sale.paymentStatus === 'COMPLETED') {
    return NextResponse.json({ error: 'Sale is already completed' }, { status: 400 });
  }

  const totalAmount = sale.items.reduce((sum, item) => sum + item.total.toNumber(), 0) - sale.discountAmount.toNumber();
  const cashierId = session.user.id;

  const updatedSale = await prisma.sale.update({
    where: { id },
    data: {
      paymentStatus: 'COMPLETED',
      paymentMethod: paymentMethod || sale.paymentMethod,
      amountPaid: amountPaid ?? sale.amountPaid,
      changeAmount: changeAmount ?? sale.changeAmount,
      totalAmount,
    },
    include: { items: true, cashier: { select: { name: true, email: true } }, branch: { select: { name: true, code: true } }, receipts: { select: { receiptNo: true } } },
  });

  for (const item of sale.items) {
    const inventory = await prisma.inventory.findFirst({
      where: { branchId: sale.branchId, productId: item.productId },
    });

    if (inventory) {
      await prisma.inventory.update({
        where: { id: inventory.id },
        data: { quantity: { decrement: item.quantity } },
      });

      await prisma.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          type: 'SALE',
          quantity: -item.quantity,
          reference: sale.id,
          notes: 'Pending sale completed',
          createdById: cashierId,
        },
      });
    }
  }

  const settings = await prisma.branchSetting.findUnique({ where: { branchId: sale.branchId } });
  if (!settings) {
    return NextResponse.json({ error: 'Branch settings not found' }, { status: 404 });
  }

  const updatedSettings = await prisma.branchSetting.update({
    where: { branchId: sale.branchId },
    data: { receiptNextNum: { increment: 1 } },
  });
  const receiptNo = `${settings.receiptPrefix || 'RCP'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(updatedSettings.receiptNextNum).padStart(5, '0')}`;

  await prisma.receipt.upsert({
    where: { saleId: sale.id },
    update: { receiptNo, printedAt: new Date() },
    create: { saleId: sale.id, receiptNo, branchId: sale.branchId },
  });

  return NextResponse.json({
    id: updatedSale.id,
    receiptNo,
    totalAmount: updatedSale.totalAmount.toNumber(),
  });
}
