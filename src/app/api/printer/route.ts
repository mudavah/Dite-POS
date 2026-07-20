import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { printer, type PrinterConfig } from '@/lib/printer/thermal-printer';
import { buildEscpos, type ReceiptData } from '@/lib/printer/receipt-template';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const branchId = session.user.branchId as string;
  const configs = await prisma.printerConfig.findMany({
    where: { branchId, isActive: true },
  });

  return NextResponse.json({ configs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action, config, data } = body as {
    action: 'print' | 'reprint' | 'preview' | 'cut' | 'buzzer';
    config?: PrinterConfig;
    data?: ReceiptData;
  };

  if (config) {
    printer.setConfig(config);
  }

  switch (action) {
    case 'print':
    case 'reprint': {
      if (!data) {
        return NextResponse.json({ error: 'Receipt data required' }, { status: 400 });
      }
      const escposData = buildEscpos(data, config?.paperSize || '80mm');
      const success = await printer.print(escposData);
      if (action === 'reprint') {
        await printer.cut();
      }
      return NextResponse.json({ success });
    }
    case 'preview': {
      if (!data) {
        return NextResponse.json({ error: 'Receipt data required' }, { status: 400 });
      }
      const escposData = buildEscpos(data, config?.paperSize || '80mm');
      return new NextResponse(escposData.buffer as any, {
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    }
    case 'cut': {
      const success = await printer.cut();
      return NextResponse.json({ success });
    }
    case 'buzzer': {
      const success = await printer.buzzer();
      return NextResponse.json({ success });
    }
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}
