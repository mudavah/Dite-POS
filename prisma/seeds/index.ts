import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL || ''),
});

async function main() {
  const adminPassword = await hash('ChangeMe123!', 12);
  const cashierPassword = await hash('ChangeMe123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@shop.com' },
    update: {},
    create: {
      email: 'admin@shop.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });

  const branch = await prisma.branch.upsert({
    where: { code: 'HQ' },
    update: {},
    create: {
      name: 'Main Branch',
      code: 'HQ',
      address: '123 Main Street, Nairobi',
      phone: '+254 700 000 000',
      email: 'hq@shop.com',
      isActive: true,
    },
  });

  await prisma.branchSetting.upsert({
    where: { branchId: branch.id },
    update: {},
    create: {
      branchId: branch.id,
      receiptPrefix: 'RCP',
      receiptNextNum: 1,
      currency: 'KES',
      currencySymbol: 'KSh',
      taxRate: 0.16,
      taxName: 'VAT',
      showTaxOnReceipt: true,
    },
  });

  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@shop.com' },
    update: {},
    create: {
      email: 'cashier@shop.com',
      name: 'John Cashier',
      password: cashierPassword,
      role: 'CASHIER',
      branchId: branch.id,
      isActive: true,
    },
  });

  await prisma.category.deleteMany({});
  const categories = await Promise.all([
    prisma.category.create({ data: { id: 'cat-1', name: 'CCTV', description: 'CCTV cameras and accessories' } }),
    prisma.category.create({ data: { id: 'cat-2', name: 'Internet', description: 'Internet services and devices' } }),
  ]);

  await prisma.product.deleteMany({});
  const products = [
    { name: 'CCTV Camera HD', sku: 'CCTV-001', barcode: '5901234123457', price: 3500, costPrice: 2200, categoryId: categories[0].id },
    { name: 'CCTV DVR 4CH', sku: 'CCTV-002', barcode: '5901234123458', price: 8000, costPrice: 5000, categoryId: categories[0].id },
    { name: 'CCTV Cable 100m', sku: 'CCTV-003', barcode: '5901234123459', price: 2500, costPrice: 1500, categoryId: categories[0].id },
    { name: 'Router WiFi 6', sku: 'NET-001', barcode: '5901234123460', price: 6500, costPrice: 4500, categoryId: categories[1].id },
    { name: 'Fiber Modem', sku: 'NET-002', barcode: '5901234123461', price: 4200, costPrice: 3000, categoryId: categories[1].id },
    { name: 'Ethernet Cable 50m', sku: 'NET-003', barcode: '5901234123462', price: 1200, costPrice: 700, categoryId: categories[1].id },
  ];

  for (const p of products) {
    await prisma.product.create({
      data: { ...p, lowStockThreshold: 5, isActive: true },
    });
  }

  const createdProducts = await prisma.product.findMany();

  await prisma.inventory.deleteMany({ where: { branchId: branch.id } });
  for (const product of createdProducts) {
    await prisma.inventory.create({
      data: {
        branchId: branch.id,
        productId: product.id,
        quantity: Math.floor(Math.random() * 100) + 10,
        reserved: 0,
      },
    });
  }

  await prisma.printerConfig.upsert({
    where: { id: 'printer-default' },
    update: {},
    create: {
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

  await prisma.etrsConfig.upsert({
    where: { branchId: branch.id },
    update: {},
    create: {
      branchId: branch.id,
      isActive: true,
      isSimulated: true,
      deviceName: 'Simulated eTRS Device',
    },
  });

  console.log('Seed completed successfully');
  console.log('Admin:', admin.email);
  console.log('Cashier:', cashier.email);
  console.log('Branch:', branch.name);
  console.log('Products created:', createdProducts.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
