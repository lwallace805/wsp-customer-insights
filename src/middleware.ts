import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware() {
    // Authenticated — let the request through
    return NextResponse.next();
  },
  {
    callbacks: {
      // Allow access only when a valid JWT token exists
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|drafts(?:/.*)?$).*)',
  ],
};
