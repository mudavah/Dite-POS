import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  sku: z.string().min(1, 'SKU is required').max(50),
  barcode: z.string().max(100).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  price: z.coerce.number().positive('Price must be positive'),
  costPrice: z.coerce.number().positive().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  lowStockThreshold: z.coerce.number().int().nonnegative().default(10),
  isActive: z.boolean().default(true),
});

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  parentId: z.string().optional().nullable(),
});

export const branchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(100),
  code: z.string().min(1, 'Branch code is required').max(20),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const userSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().nullable(),
  role: z.enum(['ADMIN', 'CASHIER']),
  branchId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const saleSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    productName: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    quantity: z.coerce.number().int().positive(),
    unitPrice: z.coerce.number().positive(),
    discount: z.coerce.number().nonnegative().default(0),
    notes: z.string().optional().nullable(),
  })).min(1, 'At least one item is required'),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'SPLIT']),
  amountPaid: z.coerce.number().nonnegative(),
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  subtotal: z.coerce.number().nonnegative().optional(),
  discountAmount: z.coerce.number().nonnegative().optional(),
  totalAmount: z.coerce.number().nonnegative().optional(),
  changeAmount: z.coerce.number().nonnegative().optional(),
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type BranchInput = z.infer<typeof branchSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
