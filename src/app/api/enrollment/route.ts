import { NextResponse } from 'next/server';
import type { CohortSummary, PacingDataPoint } from '@/lib/sheets';

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

function buildMockPacing(): PacingDataPoint[] {
  const pts: PacingDataPoint[] = [];
  for (let day = 0; day <= 120; day++) {
    const scale = (goal: number, rate: number) => Math.round(goal * Math.max(0, 1 - day * rate));
    pts.push({
      day,
      wSp24: scale(1058, 0.007),
      wFa24: scale(1154, 0.007),
      wWi25: scale(1191, 0.007),
      wSp25: scale(1035, 0.007),
      wFa25: scale(897,  0.007),
      wWi26: scale(1021, 0.007),
      wActual:   day <= 36 ? undefined : scale(1225, 0.0075),
      wForecast: scale(1225, 0.0072),
      cSu25: scale(415, 0.008),
      cFa25: scale(468, 0.008),
      cWi26: scale(485, 0.008),
      cActual:   day <= 71 ? undefined : scale(468, 0.0085),
      cForecast: scale(468, 0.008),
    });
  }
  return pts;
}

export async function GET() {
  const hasCredentials =
    !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !!process.env.GOOGLE_PACING_SHEET_ID;

  if (!hasCredentials) {
    return NextResponse.json({ summary: MOCK_SUMMARY, pacing: buildMockPacing(), mock: true });
  }

  try {
    const { getPacingData } = await import('@/lib/sheets');
    const { summary, pacing } = await getPacingData();
    return NextResponse.json({ summary, pacing, mock: false }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('Google Sheets error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
