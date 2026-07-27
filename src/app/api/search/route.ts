import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

  if (!q) {
    return NextResponse.json({ products: [], suppliers: [], purchases: [] });
  }

  const [products, suppliers, purchases] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { barcode: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, sku: true, barcode: true, price: true },
      take: limit,
    }),
    prisma.supplier.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { companyName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, companyName: true, phone: true, email: true },
      take: limit,
    }),
    prisma.purchase.findMany({
      where: {
        OR: [
          { purchaseNumber: { contains: q, mode: 'insensitive' } },
          { invoiceNumber: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, purchaseNumber: true, invoiceNumber: true, purchaseDate: true, grandTotal: true, supplier: { select: { name: true } } },
      take: limit,
    }),
  ]);

  return NextResponse.json({
    products: products.map((p) => ({ ...p, price: p.price.toNumber(), type: 'product' })),
    suppliers: suppliers.map((s) => ({ ...s, type: 'supplier' })),
    purchases: purchases.map((p) => ({
      ...p,
      grandTotal: p.grandTotal.toNumber(),
      purchaseDate: p.purchaseDate.toISOString(),
      type: 'purchase',
    })),
  });
}