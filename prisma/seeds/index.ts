import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from '@/lib/logger';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL || ''),
});

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const CASHIER_PASSWORD = process.env.SEED_CASHIER_PASSWORD;

if (!ADMIN_PASSWORD || !CASHIER_PASSWORD) {
  throw new Error('SEED_ADMIN_PASSWORD and SEED_CASHIER_PASSWORD environment variables are required for seeding');
}

const adminPasswordHash = await hash(ADMIN_PASSWORD, 12);
const cashierPasswordHash = await hash(CASHIER_PASSWORD, 12);

async function main() {

  await prisma.heldSale.deleteMany({});
  await prisma.receipt.deleteMany({});
  await prisma.saleItem.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.printerConfig.deleteMany({});
  await prisma.etrsConfig.deleteMany({});
  await prisma.branchSetting.deleteMany({});
  await prisma.branch.deleteMany({});

  const branch = await prisma.branch.create({
    data: {
      name: 'Main Branch',
      code: 'HQ',
      address: '123 Main Street, Nairobi',
      phone: '+254 700 000 000',
      email: 'hq@shop.com',
      isActive: true,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@shop.com',
      name: 'Admin User',
      password: adminPasswordHash,
      role: 'ADMIN',
      branchId: branch.id,
      isActive: true,
    },
  });

  const cashier = await prisma.user.create({
    data: {
      email: 'cashier@shop.com',
      name: 'John Cashier',
      password: cashierPasswordHash,
      role: 'CASHIER',
      branchId: branch.id,
      isActive: true,
    },
  });

  await prisma.branchSetting.create({
    data: {
      branchId: branch.id,
      receiptPrefix: 'RCP',
      receiptNextNum: 1,
      currency: 'KES',
      currencySymbol: 'KSh',
      footerText: 'Thank you for your purchase!',
    },
  });

  const categories = await Promise.all([
    prisma.category.create({ data: { id: 'cat-1', name: 'CCTV', description: 'CCTV cameras and accessories' } }),
    prisma.category.create({ data: { id: 'cat-2', name: 'Internet', description: 'Internet services and devices' } }),
  ]);

  const products = [
    { name: 'CCTV Camera HD', sku: 'CCTV-001', barcode: '5901234123457', price: 3500, costPrice: 2200, categoryId: categories[0].id },
    { name: 'CCTV DVR 4CH', sku: 'CCTV-002', barcode: '5901234123458', price: 8000, costPrice: 5000, categoryId: categories[0].id },
    { name: 'CCTV Cable 100m', sku: 'CCTV-003', barcode: '5901234123459', price: 2500, costPrice: 1500, categoryId: categories[0].id },
    { name: 'Router WiFi 6', sku: 'NET-001', barcode: '5901234123460', price: 6500, costPrice: 4500, categoryId: categories[1].id },
    { name: 'Fiber Modem', sku: 'NET-002', barcode: '5901234123461', price: 4200, costPrice: 3000, categoryId: categories[1].id },
    { name: 'Ethernet Cable 50m', sku: 'NET-003', barcode: '5901234123462', price: 1200, costPrice: 700, categoryId: categories[1].id },
  ];

  const createdProducts = [];
  for (const p of products) {
    const product = await prisma.product.create({
      data: { ...p, lowStockThreshold: 5, isActive: true },
    });
    createdProducts.push(product);
  }

  for (const product of createdProducts) {
    await prisma.inventory.create({
      data: {
        branchId: branch.id,
        productId: product.id,
        quantity: Math.floor(Math.random() * 100) + 10,
      },
    });
  }

  await prisma.printerConfig.create({
    data: {
      id: 'printer-default',
      branchId: branch.id,
      name: 'Default Thermal Printer',
      type: 'USB',
      protocol: 'ESC_POS',
      paperSize: '80mm',
      isDefault: true,
      isActive: true,
    },
  });

  await prisma.etrsConfig.create({
    data: {
      branchId: branch.id,
      isActive: true,
      isSimulated: true,
      deviceName: 'Simulated eTRS Device',
    },
  });

  logger.info('Seed completed successfully');
  logger.info('Admin:', admin.email);
  logger.info('Cashier:', cashier.email);
  logger.info('Branch:', branch.name);
  logger.info('Products created:', createdProducts.length);
}

main()
  .catch((e) => {
    logger.error('Seed failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
