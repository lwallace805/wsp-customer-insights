import CohortDashboard from '@/components/performance/CohortDashboard';
import { partnerKeyFor } from '@/lib/performance/partners';

export const dynamic = 'force-dynamic';

// ?partner=wharton (default) | cbs — read on the server so a shared link opens
// on the right partner without a flash of the default.
export default async function CohortDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).partner;
  return <CohortDashboard initialPartner={partnerKeyFor(Array.isArray(raw) ? raw[0] : raw)} />;
}
