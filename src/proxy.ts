import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const publicPaths = ['/login', '/_next', '/favicon.ico', '/api/auth'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  if (!process.env.AUTH_SECRET) {
    console.error('[proxy] AUTH_SECRET is missing from environment');
  }

  const rawSecret = process.env.AUTH_SECRET || '';
  const secretLoaded = Boolean(rawSecret);
  const secretLength = rawSecret.length;

  const cookieNames = request.cookies.getAll().map((c) => c.name);
  const sessionCookie = request.cookies.get('next-auth.session-token') || request.cookies.get('__Secure-next-auth.session-token');
  const csrfToken = request.cookies.get('next-auth.csrf-token') || request.cookies.get('__Host-next-auth.csrf-token');

  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });

  const sessionValue = sessionCookie?.value || '';
  console.log('[proxy] pathname:', pathname, 'token:', token ? 'exists' : 'null', 'cookies:', cookieNames.length, 'sessionCookie:', sessionCookie ? 'present' : 'missing', 'sessionLen:', sessionValue.length, 'csrf:', csrfToken ? 'present' : 'missing', 'secretLoaded:', secretLoaded, 'secretLength:', secretLength);

  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  if (!token && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/pos', request.url));
  }

  if (token) {
    const role = token.role as string;
    const cashierOnlyPaths = ['/pos', '/pending-sales'];
    const adminOnlyPaths = [
      '/dashboard',
      '/products',
      '/reports',
      '/settings',
      '/branches',
      '/users',
    ];

    if (role === 'CASHIER') {
      const isAdminPath = adminOnlyPaths.some((path) => {
        if (path === '/') return false;
        return pathname.startsWith(path);
      });
      if (isAdminPath) {
        return NextResponse.redirect(new URL('/pos', request.url));
      }
    }

    if (role === 'ADMIN') {
      const isCashierOnly = cashierOnlyPaths.some((path) => pathname.startsWith(path));
      if (isCashierOnly && pathname !== '/pos') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api/health).*)'],
};
