import { logger } from '@/lib/logger';
import { printer, type PrinterConfig } from './thermal-printer';
import {
  buildEscpos,
  buildFiscalEscpos,
  type ReceiptData,
  type FiscalReceiptData,
  type ReceiptTemplate,
} from './receipt-template';

export type { ReceiptTemplate } from './receipt-template';

export interface PrintReceiptInput {
  saleId: string;
  receiptNo: string;
  date: string;
  time: string;
  cashierName: string;
  customerName?: string;
  customerPin?: string;
  customerTin?: string;
  country: string;
  items: Array<{
    qty: number;
    description: string;
    vatCode: string;
    unitPrice: number;
    discount: number;
    lineTotal: number;
  }>;
  subtotal: number;
  totalAmount: number;
  cashReceived: number;
  changeAmount: number;
  controlUnitSerial: string;
  controlUnitInvoice: string;
  attendedBy: string;
  companyPin: string;
  companyAddress: string;
  companyPoBox: string;
  companyPhone: string;
  shopName: string;
  currency: string;
  currencySymbol: string;
}

export interface PrintResultMessage {
  success: boolean;
  message: string;
  error?: string;
}

class ReceiptService {
  private getPrinterConfig(): PrinterConfig | null {
    try {
      const stored = localStorage.getItem('printerConfig');
      if (!stored) return null;
      return JSON.parse(stored) as PrinterConfig;
    } catch {
      return null;
    }
  }

  async printReceipt(
    sale: PrintReceiptInput,
    template: ReceiptTemplate = 'existing'
  ): Promise<PrintResultMessage> {
    try {
      const config = this.getPrinterConfig();
      if (!config) {
        return { success: false, message: 'No printer configured', error: 'No printer configuration found' };
      }

      printer.setConfig(config);

      switch (template) {
        case 'existing': {
          const receiptData = this.mapToExistingReceipt(sale);
          const escposData = buildEscpos(receiptData, config.paperSize || '80mm');
          const result = await printer.print(escposData, { retries: 2 });
          if (result.success && config.cutter) {
            await printer.cut({ retries: 1 });
          }
          return result;
        }
        case 'fiscal': {
          const fiscalData = this.mapToFiscalReceipt(sale);
          const escposData = buildFiscalEscpos(fiscalData, config.paperSize || '80mm');
          const result = await printer.print(escposData, { retries: 2 });
          if (result.success && config.cutter) {
            await printer.cut({ retries: 1 });
          }
          return result;
        }
        case 'both': {
          const existingResult = await this.printReceipt(sale, 'existing');
          if (!existingResult.success) {
            return existingResult;
          }
          await this.feedPaper(config);
          const fiscalResult = await this.printReceipt(sale, 'fiscal');
          if (!fiscalResult.success) {
            return fiscalResult;
          }
          if (config.cutter) {
            await printer.cut({ retries: 1 });
          }
          return { success: true, message: 'Both receipts printed successfully' };
        }
        default:
          return { success: false, message: `Unknown template: ${template}`, error: 'Invalid template' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown print error';
      logger.error('ReceiptService.printReceipt failed', error);
      return { success: false, message: `Print failed: ${message}`, error: message };
    }
  }

  private mapToExistingReceipt(sale: PrintReceiptInput): ReceiptData {
    return {
      shopName: sale.shopName,
      receiptNo: sale.receiptNo,
      saleId: sale.saleId,
      date: sale.date,
      cashierName: sale.cashierName,
      customerName: sale.customerName,
      customerPin: sale.customerPin,
      items: sale.items.map((i) => ({
        productName: i.description,
        quantity: i.qty,
        unitPrice: i.unitPrice,
        discount: i.discount,
        total: i.lineTotal,
      })),
      subtotal: sale.subtotal,
      discountAmount: 0,
      total: sale.totalAmount,
      amountPaid: sale.cashReceived,
      changeAmount: sale.changeAmount,
      paymentMethod: 'CASH',
      currency: sale.currency,
      currencySymbol: sale.currencySymbol,
      qrData: sale.receiptNo,
    };
  }

  private mapToFiscalReceipt(sale: PrintReceiptInput): FiscalReceiptData {
    return {
      shopName: sale.shopName,
      companyPin: sale.companyPin,
      companyAddress: sale.companyAddress,
      companyPoBox: sale.companyPoBox,
      companyPhone: sale.companyPhone,
      receiptNo: sale.receiptNo,
      saleId: sale.saleId,
      date: sale.date,
      time: sale.time,
      customerName: sale.customerName || 'Walk-in Customer',
      customerPin: sale.customerPin || '',
      customerTin: sale.customerTin || '',
      country: sale.country,
      items: sale.items.map((i) => ({
        qty: i.qty,
        description: i.description,
        vatCode: i.vatCode,
        unitPrice: i.unitPrice,
        discount: i.discount,
        lineTotal: i.lineTotal,
      })),
      subtotal: sale.subtotal,
      totalAmount: sale.totalAmount,
      cashReceived: sale.cashReceived,
      changeAmount: sale.changeAmount,
      cashierName: sale.cashierName,
      controlUnitSerial: sale.controlUnitSerial,
      controlUnitInvoice: sale.controlUnitInvoice,
      attendedBy: sale.attendedBy,
      currency: sale.currency,
      currencySymbol: sale.currencySymbol,
      qrData: sale.receiptNo,
    };
  }

  private async feedPaper(): Promise<void> {
    try {
      const feedData = new Uint8Array([0x1B, 0x4A, 0x10]);
      await printer.print(feedData, { retries: 1 });
    } catch (error) {
      logger.warn('Paper feed failed', error);
    }
  }
}

export const receiptService = new ReceiptService();