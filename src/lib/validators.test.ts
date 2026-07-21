import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  productSchema,
  categorySchema,
  branchSchema,
  userSchema,
  saleSchema,
} from './validators';

describe('loginSchema', () => {
  it('should validate correct login data', () => {
    const result = loginSchema.safeParse({ email: 'admin@shop.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = loginSchema.safeParse({ email: 'invalid', password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const result = loginSchema.safeParse({ email: 'admin@shop.com', password: '' });
    expect(result.success).toBe(false);
  });
});

describe('productSchema', () => {
  it('should validate correct product data', () => {
    const result = productSchema.safeParse({
      name: 'Test Product',
      sku: 'TEST-001',
      barcode: '123456',
      description: 'A test product',
      price: 1000,
      costPrice: 500,
      categoryId: 'cat-1',
      lowStockThreshold: 5,
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing name', () => {
    const result = productSchema.safeParse({ sku: 'TEST-001', price: 1000 });
    expect(result.success).toBe(false);
  });

  it('should reject negative price', () => {
    const result = productSchema.safeParse({ name: 'Test', sku: 'TEST', price: -100 });
    expect(result.success).toBe(false);
  });
});

describe('categorySchema', () => {
  it('should validate correct category data', () => {
    const result = categorySchema.safeParse({
      name: 'Electronics',
      description: 'Electronic devices',
      parentId: null,
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing name', () => {
    const result = categorySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('branchSchema', () => {
  it('should validate correct branch data', () => {
    const result = branchSchema.safeParse({
      name: 'Main Branch',
      code: 'HQ',
      address: '123 Main St',
      phone: '+254700000000',
      email: 'hq@shop.com',
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = branchSchema.safeParse({
      name: 'Main Branch',
      code: 'HQ',
      email: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('userSchema', () => {
  it('should validate correct user data', () => {
    const result = userSchema.safeParse({
      name: 'John Doe',
      email: 'john@shop.com',
      password: 'password123',
      role: 'CASHIER',
      branchId: 'branch-1',
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it('should reject short password', () => {
    const result = userSchema.safeParse({
      name: 'John Doe',
      email: 'john@shop.com',
      password: '123',
      role: 'CASHIER',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid role', () => {
    const result = userSchema.safeParse({
      name: 'John Doe',
      email: 'john@shop.com',
      password: 'password123',
      role: 'SUPERADMIN' as any,
    });
    expect(result.success).toBe(false);
  });
});

describe('saleSchema', () => {
  it('should validate correct sale data', () => {
    const result = saleSchema.safeParse({
      items: [
        {
          productId: 'prod-1',
          productName: 'Test Product',
          sku: 'TEST-001',
          quantity: 2,
          unitPrice: 1000,
          discount: 100,
          notes: null,
        },
      ],
      paymentMethod: 'CASH',
      amountPaid: 1900,
      customerId: null,
      customerName: 'John Doe',
      customerPhone: '+254700000000',
      notes: null,
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty items', () => {
    const result = saleSchema.safeParse({
      items: [],
      paymentMethod: 'CASH',
      amountPaid: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid payment method', () => {
    const result = saleSchema.safeParse({
      items: [{ productId: '1', quantity: 1, unitPrice: 100 }],
      paymentMethod: 'BITCOIN',
      amountPaid: 100,
    });
    expect(result.success).toBe(false);
  });

  it('should reject passthrough unknown fields', () => {
    const result = saleSchema.safeParse({
      items: [{ productId: '1', quantity: 1, unitPrice: 100 }],
      paymentMethod: 'CASH',
      amountPaid: 100,
      paymentStatus: 'REFUNDED',
    });
    expect(result.success).toBe(false);
  });
});
