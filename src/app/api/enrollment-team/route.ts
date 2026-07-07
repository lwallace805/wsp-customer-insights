import { NextResponse } from 'next/server';
import { getEnrollmentTeamData, getServiceAccountEmail, ENROLLMENT_TEAM_SHEET_ID } from '@/lib/enrollmentTeam';
import { getActiveCohort, getCohortWeek, nowET } from '@/lib/cohortCalendar';

// Short labels used to find the active cohort's blocks/tabs inside Aubrey's
// sheet (e.g. Wharton Fall '26 → "Fall 2026" block, "FA26" KPI tab).
function hintsFor(label: string | undefined): string[] {
  if (!label) return [];
  const m = label.match(/(Fall|Spring|Winter|Summer)\s*'(\d\d)/i);
  if (!m) return [label];
  const season = m[1];
  const yy = m[2];
  return [`${season} 20${yy}`, `${season.slice(0, 2).toUpperCase()}${yy}`];
}

export async function GET() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY not configured' }, { status: 500 });
  }

  const now = nowET();
  const w = getActiveCohort('wharton', now);
  const c = getActiveCohort('columbia', now);
  const context = {
    whartonCohort: w ? { label: `Wharton ${w.label}`, week: getCohortWeek(w, now) } : null,
    columbiaCohort: c ? { label: `CBS ${c.label}`, week: getCohortWeek(c, now) } : null,
  };

  // Both families' hints — different tabs track different schools' cycles
  const hints = [...hintsFor(w?.label), ...hintsFor(c?.label)];

  const result = await getEnrollmentTeamData(hints);
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
