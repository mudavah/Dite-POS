import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const publicPaths = ['/login', '/_next', '/favicon.ico', '/api/auth'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/auth')) {
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
      const isAdminPath = adminOnlyPaths.some((path) => pathname.startsWith(path));
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
