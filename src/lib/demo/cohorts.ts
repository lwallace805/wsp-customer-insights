/**
 * Demo-mode cohort performance.
 *
 * Returns the real cohort data in production, or a deterministically perturbed
 * version in demo mode. Each cohort's volume fields (enrolls, leads, spend,
 * goals, forecasts) are scaled by a fixed seeded factor — so headline numbers
 * differ from production, while the efficiency ratios (CVR, CPL, CPE, ROAS,
 * channel mix %) stay internally consistent because numerator and denominator
 * scale together.
 */
import {
  WHARTON_COHORTS,
  COLUMBIA_COHORTS,
  type CohortData,
} from "@/data/cohortPerformance";
import { isDemo } from "@/lib/demo/flag";
import { makeRng, hashSeed } from "@/lib/demo/rng";

function factorFor(cohort: CohortData): number {
  const rng = makeRng(hashSeed(`cohort|${cohort.family}|${cohort.cohort}`));
  return 0.8 + rng() * 0.42; // ~0.80–1.22
}

function scaleCohort(c: CohortData): CohortData {
  const f = factorFor(c);
  const v = (n: number) => Math.round(n * f);
  return {
    ...c,
    totalGoal: v(c.totalGoal),
    totalEnrolls: v(c.totalEnrolls),
    totalForecast: v(c.totalForecast),
    totalSpend: v(c.totalSpend),
    // ratios (roas, cpl, cpe, cvr) and time fields unchanged
    channels: c.channels.map((ch) => ({
      ...ch,
      enrolls: v(ch.enrolls),
      leads: v(ch.leads),
      spend: v(ch.spend),
    })),
    programs: c.programs.map((p) => ({
      ...p,
      enrolls: v(p.enrolls),
      goal: v(p.goal),
      forecast: v(p.forecast),
      leads: v(p.leads),
    })),
    weekly: c.weekly.map((w) => ({
      ...w,
      spend: v(w.spend),
      spendForecast: v(w.spendForecast),
      leads: v(w.leads),
      leadsForecast: v(w.leadsForecast),
      enrolls: v(w.enrolls),
      enrollForecast: v(w.enrollForecast),
    })),
    pacing: c.pacing.map((d) => ({
      ...d,
      enrolls: v(d.enrolls),
      cumulative: v(d.cumulative),
      forecast: v(d.forecast),
    })),
  };
}

export function getWhartonCohorts(): CohortData[] {
  return isDemo() ? WHARTON_COHORTS.map(scaleCohort) : WHARTON_COHORTS;
}

export function getColumbiaCohorts(): CohortData[] {
  return isDemo() ? COLUMBIA_COHORTS.map(scaleCohort) : COLUMBIA_COHORTS;
}
