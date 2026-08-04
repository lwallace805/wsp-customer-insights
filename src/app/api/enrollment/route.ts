import { NextRequest, NextResponse } from 'next/server';
import type { CohortSummary, PacingDataPoint, ComparisonPanel, ComparisonRow } from '@/lib/sheets';
import { getWGoal, getCGoal } from '@/lib/sheets';

// Historical cohorts for mock data (oldest → newest)
const W_HIST = [
  { label: "Spring '24", goal: 1058, finalFrac: 0.99 },
  { label: "Fall '24",   goal: 1154, finalFrac: 1.02 },
  { label: "Winter '25", goal: 1191, finalFrac: 0.97 },
  { label: "Spring '25", goal: 1035, finalFrac: 1.01 },
  { label: "Fall '25",   goal:  897, finalFrac: 1.05 },
  { label: "Winter '26", goal: 1021, finalFrac: 0.98 },
];
const C_HIST = [
  { label: "Summer '25", goal: 415, finalFrac: 1.02 },
  { label: "Fall '25",   goal: 468, finalFrac: 0.99 },
  { label: "Winter '26", goal: 485, finalFrac: 1.03 },
];

const MOCK_SUMMARY: CohortSummary[] = [
  {
    cohort: "Wharton Spring '26",
    program: 'Wharton',
    goal: 1225,
    enrolled: 421,
    forecast: 468,
    daysRemaining: 36,
    histAvg: 382,
    keyTakeaway: "Wharton Spring '26 has enrolled 421 of 1,225 students (34.4%) with 36 days remaining, falling 47 short of forecast and +39 vs. the last 3-cohort average of 382.",
  },
  {
    cohort: "CBSEE Winter '26",
    program: 'CBSEE',
    goal: 468,
    enrolled: 66,
    forecast: 42,
    daysRemaining: 71,
    histAvg: 47,
    keyTakeaway: "CBSEE Winter '26 has enrolled 66 of 468 students (14.1%) with 71 days remaining, running 24 ahead of forecast and +19 vs. the last 3-cohort average of 47.",
  },
];

function sCurve(day: number): number {
  const p = (120 - day) / 120;
  const r = p < 0.3 ? p * 0.8 : p < 0.75 ? 0.24 + (p - 0.3) * 1.2 : 0.78 + (p - 0.75) * 1.8;
  return Math.min(r, 1);
}

function buildMockPacing(): PacingDataPoint[] {
  const wGoal = 1225;
  const cGoal = 468;
  const pts: PacingDataPoint[] = [];

  for (let day = 0; day <= 120; day++) {
    const f = sCurve(day);
    // pct = % of this cohort's own eventual final (pacing shape); raw = its reconstructed
    // enrollment count, scaled off the real target goal and how far over/under it finished.
    const wHistoricals = W_HIST.map(h => ({ label: h.label, pct: parseFloat((f * 100).toFixed(2)), raw: Math.round(f * h.finalFrac * h.goal) }));
    const cHistoricals = C_HIST.map(h => ({ label: h.label, pct: parseFloat((f * 100).toFixed(2)), raw: Math.round(f * h.finalFrac * h.goal) }));
    const wLast3 = wHistoricals.slice(-3);
    const cLast3 = cHistoricals.slice(-3);

    const pt: PacingDataPoint = {
      day,
      wHistoricals,
      cHistoricals,
      wLast3Pct: parseFloat((wLast3.reduce((s, h) => s + h.pct, 0) / 3).toFixed(2)),
      cLast3Pct: parseFloat((cLast3.reduce((s, h) => s + h.pct, 0) / 3).toFixed(2)),
      wForecast: Math.round(f * wGoal),
      cForecast: Math.round(f * cGoal),
    };

    if (day <= 36) {
      pt.wActualPct = parseFloat((f * 1.0 * 100).toFixed(2));
      pt.wActual = Math.round(f * 1.0 * wGoal);
    }
    if (day <= 71) {
      pt.cActualPct = parseFloat((f * 1.12 * 100).toFixed(2));
      pt.cActual = Math.round(f * 1.12 * cGoal);
    }
    pts.push(pt);
  }
  return pts;
}

function buildMockComparison(pacing: PacingDataPoint[]): { wharton: ComparisonPanel; cbsee: ComparisonPanel } {
  const wDays = 36;
  const cDays = 71;

  const findRow = (targetDay: number) =>
    pacing.reduce((best, pt) =>
      Math.abs(pt.day - targetDay) < Math.abs(best.day - targetDay) ? pt : best
    , pacing[0]);

  const buildPanel = (
    program: string,
    daysRem: number,
    activeLabel: string,
    enrolled: number,
    goal: number,
    historicals: Array<{ label: string; pct: number; raw?: number; final?: number }>,
    goalFn: (label: string) => number | null
  ): ComparisonPanel => {
    const rows: ComparisonRow[] = historicals.slice(-3).map(h => {
      const raw = h.raw ?? 0;
      const g = goalFn(h.label) ?? 0;
      return {
        label: h.label,
        enrolled: raw,
        goal: g,
        pctOfGoal: g > 0 ? parseFloat((raw / g * 100).toFixed(1)) : 0,
        pctComplete: parseFloat(h.pct.toFixed(1)),
        finalTotal: h.final ?? null,
        isActive: false,
      };
    });
    const avg = (fn: (r: ComparisonRow) => number) =>
      rows.length > 0 ? rows.reduce((s, r) => s + fn(r), 0) / rows.length : 0;
    return {
      program,
      daysRemaining: daysRem,
      activeRow: {
        label: activeLabel, enrolled, goal,
        pctOfGoal: parseFloat((enrolled / goal * 100).toFixed(1)),
        pctComplete: daysRem === 0 ? 100 : null,
        finalTotal: daysRem === 0 ? enrolled : null,
        isActive: true,
      },
      last3Avg: {
        enrolled: Math.round(avg(r => r.enrolled)),
        goal: Math.round(avg(r => r.goal)),
        pctOfGoal: parseFloat(avg(r => r.pctOfGoal).toFixed(1)),
        pctComplete: parseFloat(avg(r => r.pctComplete ?? 0).toFixed(1)),
        finalTotal: Math.round(avg(r => r.finalTotal ?? 0)) || null,
      },
      closedRows: [...rows].reverse(),
      basis: daysRem === 0 ? 'finals' : 'same-day-out',
    };
  };

  const wRow = findRow(wDays);
  const cRow = findRow(cDays);
  return {
    wharton: buildPanel('Wharton Online', wDays, "Wharton Spring '26", 421, 1225, wRow.wHistoricals, getWGoal),
    cbsee:   buildPanel('CBSEE',          cDays, "CBSEE Winter '26",   66,  468,  cRow.cHistoricals, getCGoal),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const { getEnrollmentView, parseView } = await import('@/lib/enrollmentView');
  const view = parseView(searchParams.get('cohort') ?? undefined);

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const pacing = buildMockPacing();
    const comparison = buildMockComparison(pacing);
    return NextResponse.json({
      summary: MOCK_SUMMARY,
      pacing,
      comparison,
      programs: ['wharton', 'cbsee'],
      mock: true,
    });
  }

  try {
    const { summary, pacing, comparison, programs } = await getEnrollmentView(view);
    return NextResponse.json({ summary, pacing, comparison, programs, view, mock: false }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('Google Sheets error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
