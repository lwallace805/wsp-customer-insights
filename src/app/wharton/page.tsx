import { getWhartonPartnerData } from '@/lib/whartonPartner';
import EnrollmentsView from '@/components/wharton/EnrollmentsView';

// Read live on every request — enrollment figures are keyed daily and a cached
// page would show a partner a number that is quietly a day old.
export const dynamic = 'force-dynamic';

export default async function WhartonPage() {
  const data = await getWhartonPartnerData();
  return <EnrollmentsView data={data} />;
}
