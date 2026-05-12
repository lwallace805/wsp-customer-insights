import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow login page and auth API
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // If no password configured, allow everything (local dev without env var)
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  // Check session cookie
  const token = request.cookies.get('dash_auth')?.value;
  if (token === password) return NextResponse.next();

  // Redirect to login, preserving intended destination
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
