import { withAuth } from 'next-auth/middleware';
import { NextResponse, type NextRequest } from 'next/server';

const withAuthMiddleware = withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
);

export default function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/drafts')) {
    return NextResponse.next();
  }
  return (withAuthMiddleware as unknown as (req: NextRequest) => Response)(req);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
