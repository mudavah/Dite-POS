import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { printer, type PrinterConfig } from '@/lib/printer/thermal-printer';
import { buildEscpos, buildFiscalEscpos, type ReceiptData, type FiscalReceiptData, type ReceiptTemplate } from '@/lib/printer/receipt-template';
import * as net from 'net';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function printToNetworkPrinter(ipAddress: string, port: number, data: Buffer): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const client = new net.Socket();

    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ success: false, message: `Timeout connecting to ${ipAddress}:${port}` });
    }, 15000);

    client.connect(port, ipAddress, () => {
      clearTimeout(timeout);
      client.write(data);
      setTimeout(() => {
        client.end();
        resolve({ success: true, message: `Print sent to ${ipAddress}:${port}` });
      }, 2000);
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      client.destroy();
      logger.error('Network printer error', err);
      resolve({ success: false, message: `Connection error: ${err.message}` });
    });

    client.on('timeout', () => {
      clearTimeout(timeout);
      client.destroy();
      resolve({ success: false, message: `Connection timeout to ${ipAddress}:${port}` });
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
  const { action, config, data, template } = body as {
    action: 'print' | 'reprint' | 'preview' | 'cut' | 'buzzer' | 'test';
    config?: PrinterConfig;
    data?: ReceiptData | FiscalReceiptData;
    template?: ReceiptTemplate;
  };

  if (action === 'test') {
    if (!config) {
      return NextResponse.json({ error: 'Printer config required for test' }, { status: 400 });
    }

    if (config.type === 'NETWORK' && config.ipAddress) {
      const port = config.port || 9100;
      const testData = Buffer.from('Test print from Dite POS\n');
      const result = await printToNetworkPrinter(config.ipAddress, port, testData);
      return NextResponse.json(result);
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

      const selectedTemplate = template || 'existing';
      let escposData: Uint8Array;

      if (selectedTemplate === 'fiscal' || selectedTemplate === 'both') {
        const fiscalData = data as FiscalReceiptData;
        escposData = buildFiscalEscpos(fiscalData, config?.paperSize || '80mm');
      } else {
        const receiptData = data as ReceiptData;
        escposData = buildEscpos(receiptData, config?.paperSize || '80mm');
      }

      let result;
      if (config?.type === 'NETWORK' && config.ipAddress) {
        const port = config.port || 9100;
        result = await printToNetworkPrinter(config.ipAddress, port, Buffer.from(escposData.buffer));
      } else {
        result = await printer.print(escposData, { retries: 2 });
      }

      if ((action === 'reprint' || selectedTemplate === 'both') && config?.cutter) {
        await printer.cut({ retries: 1 });
      }

      return NextResponse.json(result);
    }
    case 'preview': {
      if (!data) {
        return NextResponse.json({ error: 'Receipt data required' }, { status: 400 });
      }
      const escposData = buildEscpos(data as ReceiptData, config?.paperSize || '80mm');
      return new NextResponse(Buffer.from(escposData.buffer).toString('binary'), {
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    }
    case 'cut': {
      const result = await printer.cut();
      return NextResponse.json(result);
    }
    case 'buzzer': {
      const result = await printer.buzzer();
      return NextResponse.json(result);
    }
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}
