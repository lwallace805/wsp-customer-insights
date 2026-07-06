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
  activeRow: { label: '', enrolled: 0, goal: 0, pctOfGoal: 0, pctComplete: null, isActive: true },
  last3Avg: { enrolled: 0, goal: 0, pctOfGoal: 0, pctComplete: null },
  closedRows: [],
};

async function getData(cohort: string): Promise<PageData> {
  if (isDemo()) {
    const { getPacingData } = await import('@/lib/sheets');
    const { summary, pacing, comparison, programs } = await getPacingData();
    return { summary, pacing, comparison, programs, mock: false };
  }

  const isFall26 = cohort !== 'spring26';
  const sheetId = isFall26
    ? process.env.FALL26_PACING_SHEET_ID
    : process.env.GOOGLE_PACING_SHEET_ID;

  const hasCredentials = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !!sheetId;

  if (!hasCredentials) {
    return {
      summary: [],
      pacing: [],
      comparison: { wharton: EMPTY_PANEL, cbsee: isFall26 ? null : EMPTY_PANEL },
      programs: isFall26 ? ['wharton'] : ['wharton', 'cbsee'],
      mock: true,
    };
  }

  try {
    if (isFall26) {
      const { getPacingDataV2 } = await import('@/lib/sheets');
      const { summary, pacing, comparison, programs } = await getPacingDataV2(sheetId!);
      return { summary, pacing, comparison, programs, mock: false };
    } else {
      const { getPacingData } = await import('@/lib/sheets');
      const { summary, pacing, comparison, programs } = await getPacingData(sheetId);
      return { summary, pacing, comparison, programs, mock: false };
    }
  } catch (err) {
    console.error('Enrollment data error:', err);
    return {
      summary: [],
      pacing: [],
      comparison: { wharton: EMPTY_PANEL, cbsee: isFall26 ? null : EMPTY_PANEL },
      programs: isFall26 ? ['wharton'] : ['wharton', 'cbsee'],
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
