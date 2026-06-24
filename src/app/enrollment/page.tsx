import EnrollmentDashboard from '@/components/enrollment/EnrollmentDashboard';
import type { CohortSummary, PacingDataPoint, ComparisonPanel } from '@/lib/sheets';
import { isDemo } from '@/lib/demo/flag';

// Always fetch live data from Google Sheets — never use the static build cache
export const dynamic = 'force-dynamic';

interface PageData {
  summary: CohortSummary[];
  pacing: PacingDataPoint[];
  comparison: { wharton: ComparisonPanel; cbsee: ComparisonPanel | null };
  programs: string[];
  mock: boolean;
}

const EMPTY_PANEL: ComparisonPanel = {
  program: '',
  daysRemaining: 0,
  activeRow: { label: '', enrolled: 0, goal: 0, pctDone: 0, isActive: true },
  last3Avg: { enrolled: 0, goal: 0, pctDone: 0 },
  closedRows: [],
};

async function getData(cohort: string): Promise<PageData> {
  if (isDemo()) {
    const { getPacingData } = await import('@/lib/sheets');
    const { summary, pacing, comparison, programs } = await getPacingData();
    return { summary, pacing, comparison, programs, mock: false };
  }

  const sheetId = cohort === 'spring26'
    ? process.env.GOOGLE_PACING_SHEET_ID
    : process.env.FALL26_PACING_SHEET_ID;

  const hasCredentials = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !!sheetId;

  if (!hasCredentials) {
    return {
      summary: [],
      pacing: [],
      comparison: { wharton: EMPTY_PANEL, cbsee: EMPTY_PANEL },
      programs: ['wharton', 'cbsee'],
      mock: true,
    };
  }

  try {
    const { getPacingData } = await import('@/lib/sheets');
    const { summary, pacing, comparison, programs } = await getPacingData(sheetId);
    return { summary, pacing, comparison, programs, mock: false };
  } catch (err) {
    console.error('Enrollment data error:', err);
    return {
      summary: [],
      pacing: [],
      comparison: { wharton: EMPTY_PANEL, cbsee: null },
      programs: ['wharton'],
      mock: true,
    };
  }
}

export default async function EnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string }>;
}) {
  const { cohort = 'fall26' } = await searchParams;
  const data = await getData(cohort);
  return (
    <EnrollmentDashboard
      summary={data.summary}
      pacing={data.pacing}
      comparison={data.comparison}
      programs={data.programs}
      activeCohort={cohort}
      mock={data.mock}
    />
  );
}
