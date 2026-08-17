import { withAuth, type NextRequestWithAuth } from 'next-auth/middleware';
import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { PARTNER_COOKIE, verifyPartnerToken } from '@/lib/partnerAccess';

// ─── Two gates, not one ───────────────────────────────────────────────────────
//
//  /wharton, /api/wharton  → partner gate: shared-password cookie (30 days), OR
//                            an internal Google session (so staff following the
//                            nav link aren't asked for the partner password).
//  everything else         → NextAuth, @wallstreetprep.com only, unchanged.
//
// Order matters: the partner branch runs FIRST, so a Wharton viewer is never
// bounced to the Google sign-in page, and the partner cookie is never accepted
// anywhere except the partner surface.

const PARTNER_PREFIXES = ['/wharton', '/api/wharton'];
/** Reachable without a grant — otherwise there's no way to obtain one. */
const PARTNER_OPEN_PATHS = ['/wharton/login', '/api/wharton/session'];

function isPartnerPath(pathname: string): boolean {
  return PARTNER_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

function isPartnerOpenPath(pathname: string): boolean {
  return PARTNER_OPEN_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

const internalMiddleware = withAuth(
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

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  // Optional subdomain deployment: when WHARTON_HOST is set (e.g.
  // wharton.wsp-customer-insights.vercel.app) that hostname serves ONLY the
  // partner dashboard — "/" lands on it, and every other path is mapped into it
  // rather than exposing the internal hub on a partner-facing domain.
  //
  // The mapping is resolved to a PATH here and the rewrite is issued at the end,
  // after the gate. Rewriting up front skipped the gate entirely — a rewrite
  // response ends middleware, it does not re-enter it — which served the whole
  // dashboard unauthenticated on the partner host.
  const partnerHost = process.env.WHARTON_HOST;
  const host = req.headers.get('host')?.split(':')[0]?.toLowerCase();
  const onPartnerHost = !!partnerHost && host === partnerHost.toLowerCase();

  let rewriteTo: string | null = null;
  let effectivePath = pathname;
  if (
    onPartnerHost &&
    !isPartnerPath(pathname) &&
    // Framework asset routes are served as-is; mapping them under /wharton
    // would 404 the page's own JavaScript.
    !pathname.startsWith('/_next')
  ) {
    effectivePath = pathname === '/' ? '/wharton' : `/wharton${pathname}`;
    rewriteTo = effectivePath;
  }

  /** Continue to the resolved route, applying the host mapping if there is one. */
  const proceed = () => {
    if (!rewriteTo) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = rewriteTo;
    return NextResponse.rewrite(url);
  };

  if (isPartnerPath(effectivePath)) {
    if (isPartnerOpenPath(effectivePath)) return proceed();

    const granted = await verifyPartnerToken(req.cookies.get(PARTNER_COOKIE)?.value);
    if (granted) return proceed();

    // Internal staff reach the same page with their normal Google session.
    // A failure here (e.g. NEXTAUTH_SECRET missing) must degrade to "no internal
    // session", never to a 500 on the partner's dashboard.
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }).catch(() => null);
    if (token) return proceed();

    if (effectivePath.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const login = req.nextUrl.clone();
    login.pathname = '/wharton/login';
    login.search = '';
    // Only same-site partner paths are ever echoed back into the redirect.
    if (effectivePath !== '/wharton') login.searchParams.set('next', effectivePath);
    return NextResponse.redirect(login);
  }

  return internalMiddleware(req as NextRequestWithAuth, event);
}

export const config = {
  // Exclude /drafts from middleware so Vercel's CDN serves those static files directly.
  // Exclude /api/performance/cron so Vercel Cron can invoke it (protected by CRON_SECRET).
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|drafts|api/performance/cron).*)',
  ],
};
