import { NextResponse } from 'next/server';
import { getEnrollmentTeamData, getServiceAccountEmail, ENROLLMENT_TEAM_SHEET_ID } from '@/lib/enrollmentTeam';
import { getActiveCohort, getCohortWeek } from '@/lib/cohortCalendar';

export async function GET() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY not configured' }, { status: 500 });
  }

  const now = new Date();
  const w = getActiveCohort('wharton', now);
  const c = getActiveCohort('columbia', now);
  const context = {
    whartonCohort: w ? { label: `Wharton ${w.label}`, week: getCohortWeek(w, now) } : null,
    columbiaCohort: c ? { label: `CBS ${c.label}`, week: getCohortWeek(c, now) } : null,
  };

  const result = await getEnrollmentTeamData();
  if (!result.ok) {
    return NextResponse.json({
      ...context,
      live: null,
      needsAccess: result.needsAccess,
      serviceAccount: result.needsAccess ? getServiceAccountEmail() : null,
      sheetId: ENROLLMENT_TEAM_SHEET_ID,
      error: result.needsAccess ? null : result.error,
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json(
    { ...context, live: result.data, needsAccess: false },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
