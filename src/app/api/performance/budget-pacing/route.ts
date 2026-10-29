import { NextResponse } from 'next/server';
import { getBudgetPacing, getServiceAccountEmail } from '@/lib/performance/budgetPlan';

export const dynamic = 'force-dynamic';

// Internal only: Wharton paid budget plan vs actual spend. Sits behind the
// Google gate like every other /api/performance route; nothing here is reached
// from /wharton or src/lib/whartonPartner.ts.
export async function GET() {
  const result = await getBudgetPacing();

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
