import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getChannelTables,
  getServiceAccountEmail,
  channelTablesDocId,
} from '@/lib/performance/channelTables';
import { partnerKeyFor } from '@/lib/performance/partners';
import { getLeadPacing } from '@/lib/performance/channelPacing';

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

  // ?pacing=1 (the /channels page): Wharton lead pacing cut at the exact keyed
  // day. Opt-in, because /paid-aggregate also reads this route and has no use
  // for the extra Sheets reads.
  if (partner === 'wharton' && req.nextUrl.searchParams.get('pacing') === '1') {
    const { pacing, note } = await getLeadPacing(result.data.forecasts, result.data.programs);
    result.data.pacing = pacing;
    if (note) result.data.notes.push(note);
  }

  return NextResponse.json(
    { live: result.data, needsAccess: false, error: null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
