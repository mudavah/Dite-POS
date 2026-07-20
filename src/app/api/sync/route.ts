import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { syncEngine } from '@/lib/offline/sync-engine';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const queue = await syncEngine.getQueue();
  const pendingCount = queue.filter((i) => i.status === 'PENDING' || i.status === 'FAILED').length;
  const conflictCount = queue.filter((i) => i.status === 'CONFLICT').length;

  return NextResponse.json({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    syncStatus: pendingCount === 0 ? 'complete' : 'pending',
    pendingCount,
    conflictCount,
    items: queue,
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await syncEngine.processQueue();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
