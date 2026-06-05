import EnrollmentDashboard from '@/components/enrollment/EnrollmentDashboard';
import type { CohortSummary, PacingDataPoint, ComparisonPanel } from '@/lib/sheets';
import { isDemo } from '@/lib/demo/flag';

// Always fetch live data from Google Sheets — never use the static build cache
export const dynamic = 'force-dynamic';

interface PageData {
  summary: CohortSummary[];
  pacing: PacingDataPoint[];
  comparison: { wharton: ComparisonPanel; cbsee: ComparisonPanel };
  mock: boolean;
}

const EMPTY_PANEL: ComparisonPanel = {
  program: '',
  daysRemaining: 0,
  activeRow: { label: '', enrolled: 0, goal: 0, pctDone: 0, isActive: true },
  last3Avg: { enrolled: 0, goal: 0, pctDone: 0 },
  closedRows: [],
};

async function getData(): Promise<PageData> {
  // Demo mode: serve synthetic pacing (getPacingData() is gated to return it).
  // Bypasses the Google-credential check below since the demo has no creds.
  if (isDemo()) {
    const { getPacingData } = await import('@/lib/sheets');
    const { summary, pacing, comparison } = await getPacingData();
    return { summary, pacing, comparison, mock: false };
  }

  const hasCredentials = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !!process.env.GOOGLE_PACING_SHEET_ID;

  if (!hasCredentials) {
    return {
      summary: [],
      pacing: [],
      comparison: { wharton: EMPTY_PANEL, cbsee: EMPTY_PANEL },
      mock: true,
    };
  }

  try {
    const { getPacingData } = await import('@/lib/sheets');
    const { summary, pacing, comparison } = await getPacingData();
    return { summary, pacing, comparison, mock: false };
  } catch (err) {
    console.error('Enrollment data error:', err);
    return {
      summary: [],
      pacing: [],
      comparison: { wharton: EMPTY_PANEL, cbsee: EMPTY_PANEL },
      mock: true,
    };
  }
}

export default async function EnrollmentPage() {
  const data = await getData();
  return (
    <EnrollmentDashboard
      summary={data.summary}
      pacing={data.pacing}
      comparison={data.comparison}
      mock={data.mock}
    />
  );
}
