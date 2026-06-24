/**
 * Synthetic enrollment pacing for demo mode — same shape getPacingData() returns.
 * Deterministic. One active cohort runs ahead of forecast (Wharton), one behind (CBSEE).
 */
import type {
  CohortSummary,
  PacingDataPoint,
  ComparisonPanel,
  ComparisonRow,
} from "@/lib/sheets";

// Historical cohorts shown in demo (oldest → newest, matching column order in sheet)
const W_HIST = [
  { label: "Spring '24", goal: 1058, finalFrac: 0.99 },
  { label: "Fall '24",   goal: 1154, finalFrac: 1.02 },
  { label: "Winter '25", goal: 1191, finalFrac: 0.97 },
  { label: "Spring '25", goal: 1035, finalFrac: 1.01 },
  { label: "Fall '25",   goal:  897, finalFrac: 1.05 },
  { label: "Winter '26", goal: 1021, finalFrac: 0.98 },
];
const C_HIST = [
  { label: "Summer '25", goal: 415, finalFrac: 1.02 },
  { label: "Fall '25",   goal: 468, finalFrac: 0.99 },
  { label: "Winter '26", goal: 485, finalFrac: 1.03 },
];

const W_GOAL = 1225;
const C_GOAL = 468;
const W_CUR = 24; // days remaining for active Wharton cohort
const C_CUR = 30; // days remaining for active CBSEE cohort
const W_ACT = 1.04; // active Wharton pace (ahead of plan)
const C_ACT = 0.9;  // active CBSEE pace (behind plan)
const W_NAME = "Wharton Spring '26";
const C_NAME = "CBSEE Spring '26";

// S-curve: slow start, accelerates, spikes near the deadline.
function cumFrac(p: number): number {
  const r =
    p < 0.3 ? p * 0.8 : p < 0.75 ? 0.24 + (p - 0.3) * 1.2 : 0.78 + (p - 0.75) * 1.8;
  return Math.min(r, 1);
}

const fracAt = (day: number) => cumFrac((120 - day) / 120);
const r2 = (n: number) => parseFloat(n.toFixed(2));
const r1 = (n: number) => parseFloat(n.toFixed(1));

export function getDemoPacing(): {
  summary: CohortSummary[];
  pacing: PacingDataPoint[];
  comparison: { wharton: ComparisonPanel; cbsee: ComparisonPanel };
  programs: string[];
} {
  // ── Pacing series ──
  const pacing: PacingDataPoint[] = [];
  for (let day = 120; day >= 0; day--) {
    const f = fracAt(day);

    const wHistoricals = W_HIST.map(h => ({
      label: h.label,
      pct: r2(f * h.finalFrac * 100),
    }));
    const cHistoricals = C_HIST.map(h => ({
      label: h.label,
      pct: r2(f * h.finalFrac * 100),
    }));

    const wLast3 = wHistoricals.slice(-3);
    const cLast3 = cHistoricals.slice(-3);

    const pt: PacingDataPoint = {
      day,
      wHistoricals,
      cHistoricals,
      wLast3Pct: r2(wLast3.reduce((s, h) => s + h.pct, 0) / 3),
      cLast3Pct: r2(cLast3.reduce((s, h) => s + h.pct, 0) / 3),
      wForecast: Math.round(f * W_GOAL),
      cForecast: Math.round(f * C_GOAL),
    };

    if (day >= W_CUR) {
      pt.wActualPct = r2(f * W_ACT * 100);
      pt.wActual = Math.round(f * W_ACT * W_GOAL);
    }
    if (day >= C_CUR) {
      pt.cActualPct = r2(f * C_ACT * 100);
      pt.cActual = Math.round(f * C_ACT * C_GOAL);
    }
    pacing.push(pt);
  }
  pacing.sort((a, b) => a.day - b.day);

  // ── Summary cards ──
  const fw = fracAt(W_CUR);
  const wEnrolled = Math.round(fw * W_ACT * W_GOAL);
  const wFc = Math.round(fw * W_GOAL);
  const wHistAvg = Math.round(
    W_HIST.slice(-3).reduce((s, h) => s + fw * h.finalFrac * h.goal, 0) / 3
  );
  const wPct = r1((wEnrolled / W_GOAL) * 100).toFixed(1);

  const fc = fracAt(C_CUR);
  const cEnrolled = Math.round(fc * C_ACT * C_GOAL);
  const cFc = Math.round(fc * C_GOAL);
  const cHistAvg = Math.round(
    C_HIST.reduce((s, h) => s + fc * h.finalFrac * h.goal, 0) / 3
  );
  const cPct = r1((cEnrolled / C_GOAL) * 100).toFixed(1);

  const summary: CohortSummary[] = [
    {
      cohort: W_NAME,
      program: "Wharton",
      goal: W_GOAL,
      enrolled: wEnrolled,
      forecast: wFc,
      daysRemaining: W_CUR,
      histAvg: wHistAvg,
      keyTakeaway: `${W_NAME} has enrolled ${wEnrolled.toLocaleString()} of ${W_GOAL.toLocaleString()} students (${wPct}%) with ${W_CUR} days remaining, ${wEnrolled < wFc ? `falling ${wFc - wEnrolled} short of forecast` : `running ${wEnrolled - wFc} ahead of forecast`} and ${wEnrolled > wHistAvg ? `+${wEnrolled - wHistAvg}` : `${wEnrolled - wHistAvg}`} vs. the last 3-cohort average of ${wHistAvg.toLocaleString()}.`,
    },
    {
      cohort: C_NAME,
      program: "CBSEE",
      goal: C_GOAL,
      enrolled: cEnrolled,
      forecast: cFc,
      daysRemaining: C_CUR,
      histAvg: cHistAvg,
      keyTakeaway: `${C_NAME} has enrolled ${cEnrolled.toLocaleString()} of ${C_GOAL.toLocaleString()} students (${cPct}%) with ${C_CUR} days remaining, ${cEnrolled < cFc ? `falling ${cFc - cEnrolled} short of forecast` : `running ${cEnrolled - cFc} ahead of forecast`} and ${cEnrolled > cHistAvg ? `+${cEnrolled - cHistAvg}` : `${cEnrolled - cHistAvg}`} vs. the last 3-cohort average of ${cHistAvg.toLocaleString()}.`,
    },
  ];

  // ── Comparison panels ──
  const atDayW = pacing.find(p => p.day === W_CUR) ?? pacing[0];
  const atDayC = pacing.find(p => p.day === C_CUR) ?? pacing[0];

  const buildClosedRows = (
    historicals: Array<{ label: string; pct: number }>,
    goals: Array<{ label: string; goal: number }>
  ): ComparisonRow[] =>
    [...historicals].reverse().map(h => {
      const g = goals.find(x => x.label === h.label)?.goal ?? 0;
      return { label: h.label, enrolled: Math.round(h.pct / 100 * g), goal: g, pctDone: r1(h.pct), isActive: false };
    });

  const last3W = atDayW.wHistoricals.slice(-3);
  const last3WAvgPct = r1(last3W.reduce((s, h) => s + h.pct, 0) / 3);
  const last3WGoalAvg = Math.round(W_HIST.slice(-3).reduce((s, h) => s + h.goal, 0) / 3);

  const last3C = atDayC.cHistoricals.slice(-3);
  const last3CAvgPct = r1(last3C.reduce((s, h) => s + h.pct, 0) / 3);
  const last3CGoalAvg = Math.round(C_HIST.reduce((s, h) => s + h.goal, 0) / 3);

  const wharton: ComparisonPanel = {
    program: "Wharton Online",
    daysRemaining: W_CUR,
    activeRow: { label: W_NAME, enrolled: wEnrolled, goal: W_GOAL, pctDone: r1((wEnrolled / W_GOAL) * 100), isActive: true },
    last3Avg: { enrolled: Math.round((last3WAvgPct / 100) * last3WGoalAvg), goal: last3WGoalAvg, pctDone: last3WAvgPct },
    closedRows: buildClosedRows(atDayW.wHistoricals, W_HIST),
  };
  const cbsee: ComparisonPanel = {
    program: "CBSEE",
    daysRemaining: C_CUR,
    activeRow: { label: C_NAME, enrolled: cEnrolled, goal: C_GOAL, pctDone: r1((cEnrolled / C_GOAL) * 100), isActive: true },
    last3Avg: { enrolled: Math.round((last3CAvgPct / 100) * last3CGoalAvg), goal: last3CGoalAvg, pctDone: last3CAvgPct },
    closedRows: buildClosedRows(atDayC.cHistoricals, C_HIST),
  };

  return { summary, pacing, comparison: { wharton, cbsee }, programs: ['wharton', 'cbsee'] };
}
