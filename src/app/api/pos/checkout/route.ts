import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSale } from '@/lib/actions/sales';
import { saleSchema } from '@/lib/validators';

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

  try {
    const { sale, receiptNo } = await createSale(
      { ...validated.data, branchId, cashierId },
      undefined
    );

    return NextResponse.json({
      id: sale.id,
      receiptNo,
      totalAmount: sale.totalAmount.toNumber(),
      changeAmount: sale.changeAmount.toNumber(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 400 }
    );
  }
}
