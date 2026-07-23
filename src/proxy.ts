import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const publicPaths = ['/login', '/_next', '/favicon.ico', '/api/auth'];

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(identifier: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';

  if (pathname.startsWith('/api/auth')) {
    if (request.method === 'POST' && pathname.includes('/callback/credentials')) {
      if (!checkRateLimit(`${clientIp}:login`, 5, 10 * 60 * 1000)) {
        return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 });
      }
    }
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    cookieName: process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token',
    secureCookie: process.env.NODE_ENV === 'production',
  });

  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  if (!token && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/pos', request.url));
  }

  if (token) {
    const role = token.role as string;
    const adminOnlyPaths = [
      '/dashboard',
      '/products',
      '/reports',
      '/settings',
      '/branches',
      '/users',
    ];
    const sharedPaths = ['/pos', '/pending-sales', '/inventory'];
    const apiPaths = ['/api/pos/', '/api/sync'];

    if (role === 'CASHIER') {
      const isAdminPath = adminOnlyPaths.some((path) => pathname.startsWith(path));
      if (isAdminPath) {
        return NextResponse.redirect(new URL('/pos', request.url));
      }
    }

    if (role === 'ADMIN') {
      const isSharedPath = sharedPaths.some((path) => pathname.startsWith(path));
      const isApiPath = apiPaths.some((path) => pathname.startsWith(path));
      if (!isSharedPath && !isApiPath) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api/health).*)'],
};
