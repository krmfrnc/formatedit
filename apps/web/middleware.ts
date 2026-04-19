import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/admin', '/account', '/billing', '/support'];

export function middleware(req: NextRequest) {
  try {
    const { pathname, search } = req.nextUrl;
    const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
    if (!needsAuth) return NextResponse.next();

    const token = req.cookies.get('auth-token')?.value;
    if (token) return NextResponse.next();

    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/billing/:path*', '/support/:path*'],
};
