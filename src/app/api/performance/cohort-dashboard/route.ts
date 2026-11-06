import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCohortDashboard, getServiceAccountEmail } from '@/lib/performance/cohortDashboard';
import { partnerKeyFor } from '@/lib/performance/partners';

export const dynamic = 'force-dynamic';

// The hub's rebuild of the HubSpot cohort dashboards, on the cohort doc's daily
// tab. ?partner=wharton (default) | cbs. Internal: behind the Google gate like
// every /api/performance route; nothing here feeds the /wharton partner page.
export async function GET(req: NextRequest) {
  const partner = partnerKeyFor(req.nextUrl.searchParams.get('partner'));
  const result = await getCohortDashboard(partner);

  if (!result.ok) {
    return NextResponse.json(
      {
        live: null,
        needsAccess: result.needsAccess,
        serviceAccount: result.needsAccess ? getServiceAccountEmail() : null,
        sheetId: result.sheetId,
        error: result.needsAccess ? null : result.error,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    { live: result.data, needsAccess: false, error: null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
