import type { PacingDataPoint } from '@/lib/sheets';
import PacingChart from './PacingChart';

interface Props {
  pacing: PacingDataPoint[];
}

export default function AllCohorts({ pacing }: Props) {
  return <PacingChart data={pacing} program="Both" />;
}
