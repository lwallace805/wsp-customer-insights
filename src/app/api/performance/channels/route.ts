import { NextResponse } from 'next/server';
import {
  getChannelTables,
  getServiceAccountEmail,
  CHANNEL_TABLES_DOC_ID,
} from '@/lib/performance/channelTables';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await getChannelTables();

  if (!result.ok) {
    return NextResponse.json(
      {
        live: null,
        needsAccess: result.needsAccess,
        serviceAccount: result.needsAccess ? getServiceAccountEmail() : null,
        sheetId: CHANNEL_TABLES_DOC_ID,
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
