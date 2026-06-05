/**
 * Synthetic enrollment pacing for demo mode — same shape getPacingData()
 * returns. Deterministic. One active cohort runs ahead of forecast (Wharton),
 * one behind (CBSEE), so the dashboard tells a believable story.
 */
import type {
  CohortSummary,
  PacingDataPoint,
  ComparisonPanel,
  ComparisonRow,
} from "@/lib/sheets";

const W_GOALS = { wSp24: 1058, wFa24: 1154, wWi25: 1191, wSp25: 1035, wFa25: 897, wWi26: 1021 };
const C_GOALS = { cSu25: 415, cFa25: 468, cWi26: 485 };

// Final % of goal each closed cohort landed at (fans the historical lines out)
const W_FINAL = { wSp24: 0.99, wFa24: 1.02, wWi25: 0.97, wSp25: 1.01, wFa25: 1.05, wWi26: 0.98 };
const C_FINAL = { cSu25: 1.02, cFa25: 0.99, cWi26: 1.03 };

const W_GOAL = 1225;
const C_GOAL = 468;
const W_CUR = 24; // days remaining for active Wharton cohort
const C_CUR = 30; // days remaining for active CBSEE cohort
const W_ACT = 1.04; // active Wharton pace (ahead of plan)
const C_ACT = 0.9; // active CBSEE pace (behind plan)
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
} {
  // ── Pacing series ──
  const pacing: PacingDataPoint[] = [];
  for (let day = 120; day >= 0; day--) {
    const f = fracAt(day);
    const pt: PacingDataPoint = { day };

    pt.wSp24Pct = r2(f * W_FINAL.wSp24 * 100);
    pt.wFa24Pct = r2(f * W_FINAL.wFa24 * 100);
    pt.wWi25Pct = r2(f * W_FINAL.wWi25 * 100);
    pt.wSp25Pct = r2(f * W_FINAL.wSp25 * 100);
    pt.wFa25Pct = r2(f * W_FINAL.wFa25 * 100);
    pt.wWi26Pct = r2(f * W_FINAL.wWi26 * 100);
    pt.wLast3Pct = r2((pt.wSp25Pct + pt.wFa25Pct + pt.wWi26Pct) / 3);

    pt.cSu25Pct = r2(f * C_FINAL.cSu25 * 100);
    pt.cFa25Pct = r2(f * C_FINAL.cFa25 * 100);
    pt.cWi26Pct = r2(f * C_FINAL.cWi26 * 100);
    pt.cLast3Pct = r2((pt.cSu25Pct + pt.cFa25Pct + pt.cWi26Pct) / 3);

    pt.wForecast = Math.round(f * W_GOAL);
    pt.cForecast = Math.round(f * C_GOAL);
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
    (fw * W_FINAL.wSp25 * W_GOALS.wSp25 +
      fw * W_FINAL.wFa25 * W_GOALS.wFa25 +
      fw * W_FINAL.wWi26 * W_GOALS.wWi26) /
      3,
  );
  const wPct = r1((wEnrolled / W_GOAL) * 100).toFixed(1);

  const fc = fracAt(C_CUR);
  const cEnrolled = Math.round(fc * C_ACT * C_GOAL);
  const cFc = Math.round(fc * C_GOAL);
  const cHistAvg = Math.round(
    (fc * C_FINAL.cSu25 * C_GOALS.cSu25 +
      fc * C_FINAL.cFa25 * C_GOALS.cFa25 +
      fc * C_FINAL.cWi26 * C_GOALS.cWi26) /
      3,
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
  const wClosed: { label: string; key: keyof typeof W_FINAL; goal: number }[] = [
    { label: "Winter '26", key: "wWi26", goal: W_GOALS.wWi26 },
    { label: "Fall '25", key: "wFa25", goal: W_GOALS.wFa25 },
    { label: "Spring '25", key: "wSp25", goal: W_GOALS.wSp25 },
    { label: "Winter '25", key: "wWi25", goal: W_GOALS.wWi25 },
    { label: "Fall '24", key: "wFa24", goal: W_GOALS.wFa24 },
    { label: "Spring '24", key: "wSp24", goal: W_GOALS.wSp24 },
  ];
  const wClosedRows: ComparisonRow[] = wClosed.map((c) => {
    const enrolled = Math.round(fw * W_FINAL[c.key] * c.goal);
    return { label: c.label, enrolled, goal: c.goal, pctDone: r1((enrolled / c.goal) * 100), isActive: false };
  });

  const cClosed: { label: string; key: keyof typeof C_FINAL; goal: number }[] = [
    { label: "Winter '26", key: "cWi26", goal: C_GOALS.cWi26 },
    { label: "Fall '25", key: "cFa25", goal: C_GOALS.cFa25 },
    { label: "Summer '25", key: "cSu25", goal: C_GOALS.cSu25 },
  ];
  const cClosedRows: ComparisonRow[] = cClosed.map((c) => {
    const enrolled = Math.round(fc * C_FINAL[c.key] * c.goal);
    return { label: c.label, enrolled, goal: c.goal, pctDone: r1((enrolled / c.goal) * 100), isActive: false };
  });

  const wAvgGoal = Math.round((W_GOALS.wSp25 + W_GOALS.wFa25 + W_GOALS.wWi26) / 3);
  const wAvgPct = r1((wClosedRows[0].pctDone + wClosedRows[1].pctDone + wClosedRows[2].pctDone) / 3);
  const cAvgGoal = Math.round((C_GOALS.cSu25 + C_GOALS.cFa25 + C_GOALS.cWi26) / 3);
  const cAvgPct = r1((cClosedRows[0].pctDone + cClosedRows[1].pctDone + cClosedRows[2].pctDone) / 3);

  const wharton: ComparisonPanel = {
    program: "Wharton Online",
    daysRemaining: W_CUR,
    activeRow: { label: W_NAME, enrolled: wEnrolled, goal: W_GOAL, pctDone: r1((wEnrolled / W_GOAL) * 100), isActive: true },
    last3Avg: { enrolled: Math.round((wAvgPct / 100) * wAvgGoal), goal: wAvgGoal, pctDone: wAvgPct },
    closedRows: wClosedRows,
  };
  const cbsee: ComparisonPanel = {
    program: "CBSEE",
    daysRemaining: C_CUR,
    activeRow: { label: C_NAME, enrolled: cEnrolled, goal: C_GOAL, pctDone: r1((cEnrolled / C_GOAL) * 100), isActive: true },
    last3Avg: { enrolled: Math.round((cAvgPct / 100) * cAvgGoal), goal: cAvgGoal, pctDone: cAvgPct },
    closedRows: cClosedRows,
  };

  return { summary, pacing, comparison: { wharton, cbsee } };
}
