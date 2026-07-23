import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { printer, type PrinterConfig } from '@/lib/printer/thermal-printer';
import { buildEscpos, type ReceiptData } from '@/lib/printer/receipt-template';
import * as net from 'net';

export const dynamic = 'force-dynamic';

async function printToNetworkPrinter(ipAddress: string, port: number, data: Buffer): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new net.Socket();

    const timeout = setTimeout(() => {
      client.destroy();
      resolve(false);
    }, 10000);

    client.connect(port, ipAddress, () => {
      clearTimeout(timeout);
      client.write(data);
      setTimeout(() => {
        client.end();
        resolve(true);
      }, 500);
    });

    client.on('error', () => {
      clearTimeout(timeout);
      client.destroy();
      resolve(false);
    });

    client.on('timeout', () => {
      clearTimeout(timeout);
      client.destroy();
      resolve(false);
    });
  });
}

export async function GET(_request: NextRequest) {
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
    action: 'print' | 'reprint' | 'preview' | 'cut' | 'buzzer' | 'test';
    config?: PrinterConfig;
    data?: ReceiptData;
  };

  if (action === 'test') {
    if (!config) {
      return NextResponse.json({ error: 'Printer config required for test' }, { status: 400 });
    }

    if (config.type === 'NETWORK' && config.ipAddress) {
      const port = config.port || 9100;
      const testData = Buffer.from('Test print from Dite POS\n');
      const success = await printToNetworkPrinter(config.ipAddress, port, testData);
      return NextResponse.json({
        success,
        message: success
          ? `Successfully sent test data to ${config.ipAddress}:${port}`
          : `Failed to connect to ${config.ipAddress}:${port}`,
      });
    }

    printer.setConfig(config);
    const result = await printer.testConnection();
    return NextResponse.json(result);
  }

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

      let success = false;
      if (config?.type === 'NETWORK' && config.ipAddress) {
        const port = config.port || 9100;
        success = await printToNetworkPrinter(config.ipAddress, port, Buffer.from(escposData.buffer));
      } else {
        success = await printer.print(escposData);
      }

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
      return new NextResponse(Buffer.from(escposData.buffer).toString('binary'), {
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
