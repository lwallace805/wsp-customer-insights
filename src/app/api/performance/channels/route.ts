import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getChannelTables,
  getServiceAccountEmail,
  channelTablesDocId,
} from '@/lib/performance/channelTables';
import { partnerKeyFor } from '@/lib/performance/partners';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // ?partner=wharton (default) | cbs — the top-level filter on /channels and
  // /paid-aggregate. Each partner is a different source doc.
  const partner = partnerKeyFor(req.nextUrl.searchParams.get('partner'));
  const result = await getChannelTables(partner);

  if (!result.ok) {
    return NextResponse.json(
      {
        live: null,
        needsAccess: result.needsAccess,
        serviceAccount: result.needsAccess ? getServiceAccountEmail() : null,
        sheetId: channelTablesDocId(partner),
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
