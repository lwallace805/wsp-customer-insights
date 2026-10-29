// Provenance helpers shared by the paid dashboards (Paid Optimization and
// Paid Channel Performance): which cohort a school's paid figures describe,
// whether they were read live from its cohort doc or are the curated snapshot,
// and the notice a page shows when they are not live. Every paid figure a page
// prints sits under one of these tags, so a snapshot cohort can never pass for
// the one enrolling.

import type { School } from '@/data/performance/types';
import {
  STATIC_PAID_DATA,
  type PaidChannel, type PaidData, type PaidSchoolSource,
} from '@/data/performance/paidOptimization';
import { CHART_COLORS } from './shared';

export const SCHOOL_LABEL: Record<School, string> = { wharton: 'Wharton', columbia: 'Columbia' };

export const CHANNEL_COLOR: Record<PaidChannel, string> = {
  google: CHART_COLORS.blue,
  meta: CHART_COLORS.violet,
  linkedin: CHART_COLORS.cyan,
  bing: CHART_COLORS.amber,
  affiliates: CHART_COLORS.gray,
};

/** "Fall 2026 · live" / "Spring 2026 snapshot" — the cohort a school's channel figures describe. */
export function cohortTag(src: PaidSchoolSource): string {
  return src.state === 'live' ? `${src.cohort} · live` : `${src.cohort} snapshot`;
}

/** The cohort one PART of a school's paid data describes — its weekly series,
 *  or Wharton's program × channel leaves — and the tag to print beside it. A
 *  part is live only when it was read from the cohort doc and reconciled
 *  (`src.weeklyLive` / `src.programsLive`); otherwise it is the snapshot's
 *  cohort even when the school's channel totals are live. */
export function partCohort(src: PaidSchoolSource, partLive: boolean, school: School): { cohort: string; tag: string } {
  const cohort = partLive ? src.cohort : STATIC_PAID_DATA.cohortContext[school].cohort;
  return { cohort, tag: partLive ? cohort : `${cohort} snapshot` };
}

/** Why a school's paid figures are not live from its cohort doc, for the page. */
export function SourceNotice({ school, data }: { school: School; data: PaidData }) {
  const src = data.sources[school];
  if (src.state === 'live') return null;
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-5 py-3 text-xs text-amber-200/90 leading-relaxed">
      <span className="font-semibold">{SCHOOL_LABEL[school]} — showing the {src.cohort} snapshot</span>
      {' '}(curated {STATIC_PAID_DATA.asOf}), not the current cohort.{' '}
      {src.note ?? 'The live paid layer is not available for this school.'}
    </div>
  );
}
