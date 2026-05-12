import { NextResponse } from 'next/server';
import type { CohortSummary, PacingDataPoint, ComparisonPanel } from '@/lib/sheets';

// Mock data shown when credentials are not configured
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

const W_GOALS = { wSp24: 1058, wFa24: 1154, wWi25: 1191, wSp25: 1035, wFa25: 897, wWi26: 1021 };
const C_GOALS = { cSu25: 415, cFa25: 468, cWi26: 485 };

function buildMockPacing(): PacingDataPoint[] {
  const pts: PacingDataPoint[] = [];
  const wGoal = 1225;
  const cGoal = 468;

  for (let day = 0; day <= 120; day++) {
    const rawW = (goal: number, rate: number) => Math.round(goal * Math.max(0, 1 - day * rate));
    const rawC = (goal: number, rate: number) => Math.round(goal * Math.max(0, 1 - day * rate));

    const wSp24 = rawW(W_GOALS.wSp24, 0.007);
    const wFa24 = rawW(W_GOALS.wFa24, 0.007);
    const wWi25 = rawW(W_GOALS.wWi25, 0.007);
    const wSp25 = rawW(W_GOALS.wSp25, 0.007);
    const wFa25 = rawW(W_GOALS.wFa25, 0.007);
    const wWi26 = rawW(W_GOALS.wWi26, 0.007);
    const wActual   = day <= 36 ? undefined : rawW(wGoal, 0.0075);
    const wForecast = rawW(wGoal, 0.0072);

    const cSu25 = rawC(C_GOALS.cSu25, 0.008);
    const cFa25 = rawC(C_GOALS.cFa25, 0.008);
    const cWi26 = rawC(C_GOALS.cWi26, 0.008);
    const cActual   = day <= 71 ? undefined : rawC(cGoal, 0.0085);
    const cForecast = rawC(cGoal, 0.008);

    const pct = (v: number, goal: number) => parseFloat((v / goal * 100).toFixed(2));

    const wSp25Pct = pct(wSp25, W_GOALS.wSp25);
    const wFa25Pct = pct(wFa25, W_GOALS.wFa25);
    const wWi26Pct = pct(wWi26, W_GOALS.wWi26);
    const cSu25Pct = pct(cSu25, C_GOALS.cSu25);
    const cFa25Pct = pct(cFa25, C_GOALS.cFa25);
    const cWi26Pct = pct(cWi26, C_GOALS.cWi26);

    const pt: PacingDataPoint = {
      day,
      wSp24Pct: pct(wSp24, W_GOALS.wSp24),
      wFa24Pct: pct(wFa24, W_GOALS.wFa24),
      wWi25Pct: pct(wWi25, W_GOALS.wWi25),
      wSp25Pct,
      wFa25Pct,
      wWi26Pct,
      wActualPct: wActual !== undefined ? pct(wActual, wGoal) : undefined,
      wLast3Pct: parseFloat(((wSp25Pct + wFa25Pct + wWi26Pct) / 3).toFixed(2)),
      cSu25Pct,
      cFa25Pct,
      cWi26Pct,
      cActualPct: cActual !== undefined ? pct(cActual, cGoal) : undefined,
      cLast3Pct: parseFloat(((cSu25Pct + cFa25Pct + cWi26Pct) / 3).toFixed(2)),
      wActual,
      wForecast,
      cActual,
      cForecast,
    };
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

  const wRow = findRow(wDays);
  const cRow = findRow(cDays);

  const wharton: ComparisonPanel = {
    program: 'Wharton Online',
    daysRemaining: wDays,
    activeRow: { label: "Wharton Spring '26", enrolled: 421, goal: 1225, pctDone: 34.4, isActive: true },
    last3Avg: {
      enrolled: Math.round(((wRow.wSp25Pct ?? 0) + (wRow.wFa25Pct ?? 0) + (wRow.wWi26Pct ?? 0)) / 3 / 100 * Math.round((W_GOALS.wSp25 + W_GOALS.wFa25 + W_GOALS.wWi26) / 3)),
      goal: Math.round((W_GOALS.wSp25 + W_GOALS.wFa25 + W_GOALS.wWi26) / 3),
      pctDone: parseFloat((((wRow.wSp25Pct ?? 0) + (wRow.wFa25Pct ?? 0) + (wRow.wWi26Pct ?? 0)) / 3).toFixed(1)),
    },
    closedRows: [
      { label: "Winter '26", enrolled: Math.round((wRow.wWi26Pct ?? 0) / 100 * W_GOALS.wWi26), goal: W_GOALS.wWi26, pctDone: parseFloat((wRow.wWi26Pct ?? 0).toFixed(1)), isActive: false },
      { label: "Fall '25",   enrolled: Math.round((wRow.wFa25Pct ?? 0) / 100 * W_GOALS.wFa25), goal: W_GOALS.wFa25, pctDone: parseFloat((wRow.wFa25Pct ?? 0).toFixed(1)), isActive: false },
      { label: "Spring '25", enrolled: Math.round((wRow.wSp25Pct ?? 0) / 100 * W_GOALS.wSp25), goal: W_GOALS.wSp25, pctDone: parseFloat((wRow.wSp25Pct ?? 0).toFixed(1)), isActive: false },
      { label: "Winter '25", enrolled: Math.round((wRow.wWi25Pct ?? 0) / 100 * W_GOALS.wWi25), goal: W_GOALS.wWi25, pctDone: parseFloat((wRow.wWi25Pct ?? 0).toFixed(1)), isActive: false },
      { label: "Fall '24",   enrolled: Math.round((wRow.wFa24Pct ?? 0) / 100 * W_GOALS.wFa24), goal: W_GOALS.wFa24, pctDone: parseFloat((wRow.wFa24Pct ?? 0).toFixed(1)), isActive: false },
      { label: "Spring '24", enrolled: Math.round((wRow.wSp24Pct ?? 0) / 100 * W_GOALS.wSp24), goal: W_GOALS.wSp24, pctDone: parseFloat((wRow.wSp24Pct ?? 0).toFixed(1)), isActive: false },
    ],
  };

  const cbsee: ComparisonPanel = {
    program: 'CBSEE',
    daysRemaining: cDays,
    activeRow: { label: "CBSEE Winter '26", enrolled: 66, goal: 468, pctDone: 14.1, isActive: true },
    last3Avg: {
      enrolled: Math.round(((cRow.cSu25Pct ?? 0) + (cRow.cFa25Pct ?? 0) + (cRow.cWi26Pct ?? 0)) / 3 / 100 * Math.round((C_GOALS.cSu25 + C_GOALS.cFa25 + C_GOALS.cWi26) / 3)),
      goal: Math.round((C_GOALS.cSu25 + C_GOALS.cFa25 + C_GOALS.cWi26) / 3),
      pctDone: parseFloat((((cRow.cSu25Pct ?? 0) + (cRow.cFa25Pct ?? 0) + (cRow.cWi26Pct ?? 0)) / 3).toFixed(1)),
    },
    closedRows: [
      { label: "Winter '26", enrolled: Math.round((cRow.cWi26Pct ?? 0) / 100 * C_GOALS.cWi26), goal: C_GOALS.cWi26, pctDone: parseFloat((cRow.cWi26Pct ?? 0).toFixed(1)), isActive: false },
      { label: "Fall '25",   enrolled: Math.round((cRow.cFa25Pct ?? 0) / 100 * C_GOALS.cFa25), goal: C_GOALS.cFa25, pctDone: parseFloat((cRow.cFa25Pct ?? 0).toFixed(1)), isActive: false },
      { label: "Summer '25", enrolled: Math.round((cRow.cSu25Pct ?? 0) / 100 * C_GOALS.cSu25), goal: C_GOALS.cSu25, pctDone: parseFloat((cRow.cSu25Pct ?? 0).toFixed(1)), isActive: false },
    ],
  };

  return { wharton, cbsee };
}

export async function GET() {
  const hasCredentials =
    !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !!process.env.GOOGLE_PACING_SHEET_ID;

  if (!hasCredentials) {
    const pacing = buildMockPacing();
    const comparison = buildMockComparison(pacing);
    return NextResponse.json({ summary: MOCK_SUMMARY, pacing, comparison, mock: true });
  }

  try {
    const { getPacingData } = await import('@/lib/sheets');
    const { summary, pacing, comparison } = await getPacingData();
    return NextResponse.json({ summary, pacing, comparison, mock: false }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('Google Sheets error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
