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

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { id: 'cat-1' },
      update: {},
      create: { id: 'cat-1', name: 'Electronics', description: 'Electronic devices and accessories' },
    }),
    prisma.category.upsert({
      where: { id: 'cat-2' },
      update: {},
      create: { id: 'cat-2', name: 'Groceries', description: 'Food and household items' },
    }),
    prisma.category.upsert({
      where: { id: 'cat-3' },
      update: {},
      create: { id: 'cat-3', name: 'Clothing', description: 'Apparel and fashion' },
    }),
  ]);

  const products = [
    { name: 'Wireless Headphones', sku: 'ELEC-001', barcode: '5901234123457', price: 3500, costPrice: 2200, categoryId: categories[0].id },
    { name: 'USB-C Cable', sku: 'ELEC-002', barcode: '5901234123458', price: 800, costPrice: 400, categoryId: categories[0].id },
    { name: 'Smart Watch', sku: 'ELEC-003', barcode: '5901234123459', price: 12500, costPrice: 8000, categoryId: categories[0].id },
    { name: 'Rice 5kg', sku: 'GROC-001', barcode: '5901234123460', price: 650, costPrice: 500, categoryId: categories[1].id },
    { name: 'Cooking Oil 2L', sku: 'GROC-002', barcode: '5901234123461', price: 450, costPrice: 320, categoryId: categories[1].id },
    { name: 'Sugar 2kg', sku: 'GROC-003', barcode: '5901234123462', price: 220, costPrice: 170, categoryId: categories[1].id },
    { name: 'Men T-Shirt', sku: 'CLO-001', barcode: '5901234123463', price: 1200, costPrice: 700, categoryId: categories[2].id },
    { name: 'Women Dress', sku: 'CLO-002', barcode: '5901234123464', price: 2500, costPrice: 1500, categoryId: categories[2].id },
    { name: 'Sneakers', sku: 'CLO-003', barcode: '5901234123465', price: 4500, costPrice: 2800, categoryId: categories[2].id },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: { ...p, lowStockThreshold: 5, isActive: true },
    });
  }

  const createdProducts = await prisma.product.findMany();

  for (const product of createdProducts) {
    await prisma.inventory.upsert({
      where: { branchId_productId: { branchId: branch.id, productId: product.id } },
      update: {},
      create: {
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
