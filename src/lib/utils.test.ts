import { describe, it, expect } from 'vitest';
import { sanitizeText, formatCurrency, generateReceiptNumber, generateEtrsRef } from './utils';

describe('sanitizeText', () => {
  it('should strip HTML tags from text', () => {
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('alert("xss")');
    expect(sanitizeText('<b>Bold</b>')).toBe('Bold');
    expect(sanitizeText('<img src="x" onerror="alert(1)">')).toBe('');
  });

  it('should handle plain text', () => {
    expect(sanitizeText('Hello World')).toBe('Hello World');
  });

  it('should return null for null input', () => {
    expect(sanitizeText(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(sanitizeText(undefined)).toBeUndefined();
  });

  it('should trim whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });
});

describe('formatCurrency', () => {
  it('should format KES currency', () => {
    const result = formatCurrency(1500);
    expect(result).toContain('1,500');
    expect(result).toContain('KSh');
  });

  it('should handle zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0.00');
  });

  it('should handle decimal values', () => {
    const result = formatCurrency(99.5);
    expect(result).toContain('99.50');
  });
});

describe('generateReceiptNumber', () => {
  it('should generate receipt number with prefix and padded number', () => {
    const result = generateReceiptNumber('RCP', 42);
    expect(result).toMatch(/^RCP-\d{8}-00042$/);
  });

  it('should handle default prefix', () => {
    const result = generateReceiptNumber('RCP', 1);
    expect(result).toMatch(/^RCP-\d{8}-00001$/);
  });
});

describe('generateEtrsRef', () => {
  it('should generate ETRS reference with timestamp and random string', () => {
    const result = generateEtrsRef();
    expect(result).toMatch(/^ETRS-[A-Z0-9]+-[A-Z0-9]+$/);
  });

  it('should generate unique references', () => {
    const ref1 = generateEtrsRef();
    const ref2 = generateEtrsRef();
    expect(ref1).not.toBe(ref2);
  });
});
