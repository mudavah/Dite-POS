export function toNumeric(value: unknown, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (typeof value === 'object' && value !== null && typeof (value as { toNumber?: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  return fallback;
}

export function toNullableNumeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = toNumeric(value);
  return Number.isFinite(num) ? num : null;
}
