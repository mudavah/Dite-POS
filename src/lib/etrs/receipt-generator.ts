import { prisma } from '@/lib/prisma';

export interface EtrsReceiptRecord {
  id: string;
  receiptId: string;
  receiptRef: string;
  cuUrl?: string;
  receiptType: string;
  metadata?: string;
  isSynced: boolean;
  syncedAt?: Date;
  createdAt: Date;
}

export async function generateEtrsReceipt(
  receiptId: string,
  branchId: string,
  options?: { receiptType?: string; cuUrl?: string; metadata?: Record<string, unknown> }
): Promise<EtrsReceiptRecord> {
  const receiptRef = generateReceiptRef();
  const metadata = options?.metadata ? JSON.stringify(options.metadata) : undefined;

  const etrsReceipt = await prisma.etrsReceipt.create({
    data: {
      receiptId,
      receiptRef,
      receiptType: options?.receiptType || 'INVOICE',
      cuUrl: options?.cuUrl,
      metadata,
      isSynced: false,
    },
  });

  return mapEtrsReceipt(etrsReceipt);
}

export async function getEtrsReceipt(receiptId: string): Promise<EtrsReceiptRecord | null> {
  const etrsReceipt = await prisma.etrsReceipt.findUnique({
    where: { receiptId },
  });

  if (!etrsReceipt) return null;
  return mapEtrsReceipt(etrsReceipt);
}

export async function getEtrsHistory(branchId: string, limit = 50): Promise<EtrsReceiptRecord[]> {
  const etrsReceipts = await prisma.etrsReceipt.findMany({
    where: { receipt: { branchId } },
    include: { receipt: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return etrsReceipts.map(mapEtrsReceipt);
}

export async function markEtrsSynced(receiptId: string): Promise<void> {
  await prisma.etrsReceipt.update({
    where: { receiptId },
    data: { isSynced: true, syncedAt: new Date() },
  });
}

export function generateReceiptRef(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ETRS-${timestamp}-${random}`;
}

export function prepareEtrsPayload(record: EtrsReceiptRecord): Record<string, unknown> {
  return {
    receiptRef: record.receiptRef,
    receiptType: record.receiptType,
    cuUrl: record.cuUrl,
    metadata: record.metadata ? JSON.parse(record.metadata) : null,
    isSynced: record.isSynced,
    syncedAt: record.syncedAt?.toISOString(),
  };
}

export function validateEtrsPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const obj = payload as Record<string, unknown>;
  return typeof obj.receiptRef === 'string' && typeof obj.receiptType === 'string';
}

function mapEtrsReceipt(r: {
  id: string;
  receiptId: string;
  receiptRef: string;
  cuUrl: string | null;
  receiptType: string;
  metadata: string | null;
  isSynced: boolean;
  syncedAt: Date | null;
  createdAt: Date;
}): EtrsReceiptRecord {
  return {
    id: r.id,
    receiptId: r.receiptId,
    receiptRef: r.receiptRef,
    cuUrl: r.cuUrl ?? undefined,
    receiptType: r.receiptType,
    metadata: r.metadata ?? undefined,
    isSynced: r.isSynced,
    syncedAt: r.syncedAt ?? undefined,
    createdAt: r.createdAt,
  };
}
