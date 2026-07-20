import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import {
  generateEtrsReceipt,
  getEtrsReceipt,
  getEtrsHistory,
  markEtrsSynced,
} from '@/lib/etrs/receipt-generator';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const branchId = session.user.branchId as string;
  const url = new URL(req.url);
  const receiptId = url.searchParams.get('receiptId');

  if (receiptId) {
    const receipt = await getEtrsReceipt(receiptId);
    if (!receipt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(receipt);
  }

  const history = await getEtrsHistory(branchId);
  return NextResponse.json({ history });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action, receiptId, branchId, options } = body as {
    action: 'generate' | 'mark-synced';
    receiptId?: string;
    branchId?: string;
    options?: { receiptType?: string; cuUrl?: string; metadata?: Record<string, unknown> };
  };

  if (action === 'generate') {
    if (!receiptId || !branchId) {
      return NextResponse.json({ error: 'receiptId and branchId are required' }, { status: 400 });
    }

    const existing = await getEtrsReceipt(receiptId);
    if (existing) {
      return NextResponse.json({ error: 'eTRS receipt already exists' }, { status: 409 });
    }

    const record = await generateEtrsReceipt(receiptId, branchId, options);
    return NextResponse.json(record, { status: 201 });
  }

  if (action === 'mark-synced') {
    if (!receiptId) {
      return NextResponse.json({ error: 'receiptId is required' }, { status: 400 });
    }
    await markEtrsSynced(receiptId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
