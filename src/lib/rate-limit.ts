import { NextRequest } from 'next/server';

type RateLimitEntry = { count: number; resetAt: number };

const store = new Map<string, RateLimitEntry>();

export function rateLimit(options: { limit: number; windowMs: number }) {
  return (identifier: string): { success: boolean; remaining: number } => {
    const now = Date.now();
    const entry = store.get(identifier);

    if (!entry || now > entry.resetAt) {
      store.set(identifier, { count: 1, resetAt: now + options.windowMs });
      return { success: true, remaining: options.limit - 1 };
    }

    entry.count += 1;

    if (entry.count > options.limit) {
      return { success: false, remaining: 0 };
    }

    return { success: true, remaining: options.limit - entry.count };
  };
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}
