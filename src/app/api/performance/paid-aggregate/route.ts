import { NextResponse } from 'next/server';
import {
  getPaidAggregate,
  getServiceAccountEmail,
  PAID_AGGREGATE_SHEET_ID,
} from '@/lib/performance/paidAggregate';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await getPaidAggregate();

  if (!result.ok) {
    return NextResponse.json(
      {
        live: null,
        needsAccess: result.needsAccess,
        serviceAccount: result.needsAccess ? getServiceAccountEmail() : null,
        sheetId: PAID_AGGREGATE_SHEET_ID,
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
