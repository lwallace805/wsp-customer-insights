import EnrollmentDashboard from '@/components/enrollment/EnrollmentDashboard';
import type { CohortSummary, PacingDataPoint } from '@/lib/sheets';

async function getData(): Promise<{ summary: CohortSummary[]; pacing: PacingDataPoint[]; mock: boolean }> {
  const hasCredentials = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !!process.env.GOOGLE_PACING_SHEET_ID;

  if (!hasCredentials) {
    // Return empty — the API route handles mock data; here we just pass empties so the
    // client component can show the mock banner without needing a network call.
    return { summary: [], pacing: [], mock: true };
  }

  try {
    const { getPacingData } = await import('@/lib/sheets');
    const { summary, pacing } = await getPacingData();
    return { summary, pacing, mock: false };
  } catch (err) {
    console.error('Enrollment data error:', err);
    return { summary: [], pacing: [], mock: true };
  }
}

export default async function EnrollmentPage() {
  const data = await getData();
  return <EnrollmentDashboard summary={data.summary} pacing={data.pacing} mock={data.mock} />;
}
