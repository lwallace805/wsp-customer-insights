import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      // DISABLE_AUTH is a local-dev-only escape hatch (double-gated so it can
      // never activate in a production build).
      authorized: ({ token }) =>
        !!token ||
        (process.env.NODE_ENV !== 'production' && process.env.DISABLE_AUTH === '1'),
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  // Exclude /drafts from middleware so Vercel's CDN serves those static files directly.
  // Exclude /api/performance/cron so Vercel Cron can invoke it (protected by CRON_SECRET).
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|drafts|api/performance/cron).*)',
  ],
};
