import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getPaidAggregate,
  getServiceAccountEmail,
  paidAggregateDocId,
} from '@/lib/performance/paidAggregate';
import { partnerKeyFor } from '@/lib/performance/partners';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // ?partner=wharton (default) | cbs. Wharton's paid figures come from the
  // funnel doc's "Paid Marketing Aggregate" tab; CBS AI has no such tab and is
  // assembled from its cohort doc's Paid WoW blocks.
  const partner = partnerKeyFor(req.nextUrl.searchParams.get('partner'));
  const result = await getPaidAggregate(partner);

  if (!result.ok) {
    return NextResponse.json(
      {
        live: null,
        needsAccess: result.needsAccess,
        serviceAccount: result.needsAccess ? getServiceAccountEmail() : null,
        sheetId: paidAggregateDocId(partner),
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
