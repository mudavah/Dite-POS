'use client';

import * as React from 'react';
import { printer, type PrinterConfig, type PrintResult } from '@/lib/printer/thermal-printer';
import {
  buildEscpos,
  buildFiscalEscpos,
  type ReceiptData,
  type FiscalReceiptData,
  type ReceiptTemplate,
} from '@/lib/printer/receipt-template';
import { logger } from '@/lib/logger';

interface ReceiptPrinterProps {
  config: PrinterConfig;
  data: ReceiptData | FiscalReceiptData;
  template: ReceiptTemplate;
  onPrint?: (result: PrintResult) => void;
}

export function ReceiptPrinter({ config, data, template, onPrint }: ReceiptPrinterProps) {
  const [isPrinting, setIsPrinting] = React.useState(false);

  const handlePrint = async () => {
    setIsPrinting(true);

    try {
      printer.setConfig(config);

      let escposData: Uint8Array;
      switch (template) {
        case 'existing':
          escposData = buildEscpos(data as ReceiptData, config.paperSize || '80mm');
          break;
        case 'fiscal':
          escposData = buildFiscalEscpos(data as FiscalReceiptData, config.paperSize || '80mm');
          break;
        case 'both': {
          const existingData = data as ReceiptData;
          const fiscalData = data as FiscalReceiptData;
          const existingResult = await printer.print(
            buildEscpos(existingData, config.paperSize || '80mm'),
            { retries: 2 }
          );
          if (!existingResult.success) {
            onPrint?.(existingResult);
            return;
          }
          await feedPaper();
          const fiscalResult = await printer.print(
            buildFiscalEscpos(fiscalData, config.paperSize || '80mm'),
            { retries: 2 }
          );
          if (fiscalResult.success && config.cutter) {
            await printer.cut({ retries: 1 });
          }
          onPrint?.(fiscalResult);
          return;
        }
        default:
          throw new Error(`Unknown template: ${template}`);
      }

      const result = await printer.print(escposData, { retries: 2 });
      if (result.success && config.cutter) {
        await printer.cut({ retries: 1 });
      }
      onPrint?.(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Print failed';
      logger.error('ReceiptPrinter print failed', err);
      onPrint?.({ success: false, message, error: message });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <button
      onClick={handlePrint}
      disabled={isPrinting}
      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
    >
      {isPrinting ? 'Printing...' : 'Print Receipt'}
    </button>
  );
}

async function feedPaper(): Promise<void> {
  try {
    const feedData = new Uint8Array([0x1B, 0x4A, 0x10]);
    await printer.print(feedData, { retries: 1 });
  } catch (error) {
    logger.warn('Paper feed failed', error);
  }
}