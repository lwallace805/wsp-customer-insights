import EnrollmentDashboard from '@/components/enrollment/EnrollmentDashboard';
import type { CohortSummary, PacingDataPoint, ComparisonPanel } from '@/lib/sheets';
import { isDemo } from '@/lib/demo/flag';
import { getEnrollmentView, parseView, viewLabels, type EnrollmentView } from '@/lib/enrollmentView';

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
  activeRow: { label: '', enrolled: 0, goal: 0, pctOfGoal: 0, pctComplete: null, finalTotal: null, isActive: true },
  last3Avg: { enrolled: 0, goal: 0, pctOfGoal: 0, pctComplete: null, finalTotal: null },
  closedRows: [],
  basis: 'same-day-out',
};

async function getData(view: EnrollmentView): Promise<PageData> {
  if (isDemo()) {
    const { getPacingData } = await import('@/lib/sheets');
    const { summary, pacing, comparison, programs } = await getPacingData();
    return { summary, pacing, comparison, programs, mock: false };
  }

  const empty = (mock: boolean): PageData => ({
    summary: [],
    pacing: [],
    comparison: { wharton: EMPTY_PANEL, cbsee: EMPTY_PANEL },
    programs: ['wharton', 'cbsee'],
    mock,
  });

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return empty(true);

  try {
    const { summary, pacing, comparison, programs } = await getEnrollmentView(view);
    return { summary, pacing, comparison, programs, mock: false };
  } catch (err) {
    console.error('Enrollment data error:', err);
    return empty(true);
  }
}

export default async function EnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string }>;
}) {
  const { cohort } = await searchParams;
  const view = parseView(cohort);
  const data = await getData(view);
  return (
    <EnrollmentDashboard
      summary={data.summary}
      pacing={data.pacing}
      comparison={data.comparison}
      programs={data.programs}
      activeCohort={view}
      cohortOptions={viewLabels()}
      mock={data.mock}
    />
  );
}
