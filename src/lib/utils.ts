import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency: string = 'KES', symbol: string = 'KSh') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${symbol} ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateReceiptNumber(prefix: string = 'RCP', nextNum: number) {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${dateStr}-${String(nextNum).padStart(5, '0')}`;
}

export function generateEtrsRef() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ETRS-${timestamp}-${random}`;
}

export function sanitizeText(text: string | null | undefined): string | null | undefined {
  if (!text) return text;
  return text.replace(/<[^>]*>/g, '').trim();
}
