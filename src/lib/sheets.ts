import { google } from 'googleapis';
import { isDemo } from '@/lib/demo/flag';
import { getDemoPacing } from '@/lib/demo/enrollment';

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

// Strip commas/percent signs and parse to number; returns null if blank/invalid
function N(v: string | undefined | null): number | null {
  if (!v || v.trim() === '' || v === '#DIV/0!' || v === '#REF!') return null;
  const n = parseFloat(v.replace(/,/g, '').replace(/%/g, '').trim());
  return isNaN(n) ? null : n;
}

// Historical cohort goals keyed by label — Wharton and CBSEE kept separate to avoid
// name collision (both programs have cohorts like "Fall '25" with different goals).
// Add a new entry here when a cohort becomes historical.
export const W_GOALS: Record<string, number> = {
  "Spring '24": 1058, "Fall '24": 1154, "Winter '25": 1191,
  "Spring '25": 1035, "Fall '25": 897,  "Winter '26": 1021, "Spring '26": 1225,
};
export const C_GOALS: Record<string, number> = {
  "Summer '25": 415, "Fall '25": 468, "Winter '26": 485, "Summer '26": 468,
};

// Strip leading program name prefix so "Wharton Spring '24" → "Spring '24"
function normLabel(raw: string): string {
  return raw.replace(/^(wharton online?|wharton|cbsee|cbs)\s+/i, '').trim();
}
export function getWGoal(label: string): number | null {
  return W_GOALS[normLabel(label)] ?? W_GOALS[label] ?? null;
}
export function getCGoal(label: string): number | null {
  return C_GOALS[normLabel(label)] ?? C_GOALS[label] ?? null;
}

export interface CohortSummary {
  cohort: string;
  program: string;
  goal: number;
  enrolled: number;
  forecast: number;
  daysRemaining: number;
  histAvg: number; // avg raw enrollment of last 3 completed cohorts at same days-remaining point
  keyTakeaway: string;
}

export interface PacingDataPoint {
  day: number;
  // Dynamic historical % lines — ordered oldest→newest (matches column order in sheet).
  // Labels are read from the sheet header row so they self-update when cohorts rotate.
  wHistoricals: Array<{ label: string; pct: number }>;
  cHistoricals: Array<{ label: string; pct: number }>;
  // Active cohort computed fields
  wActualPct?: number;
  wLast3Pct?: number;
  cActualPct?: number;
  cLast3Pct?: number;
  // Raw enrollment for forecast charts
  wActual?: number;
  wForecast?: number;
  cActual?: number;
  cForecast?: number;
}

export interface ComparisonRow {
  label: string;
  enrolled: number;
  goal: number;
  pctDone: number;
  isActive: boolean;
}

export interface ComparisonPanel {
  program: string;
  daysRemaining: number;
  activeRow: ComparisonRow;
  last3Avg: { enrolled: number; goal: number; pctDone: number };
  closedRows: ComparisonRow[];
}

// Column indices (0-based) in the "Overall Cohort - AN Summary" pacing table.
// Positions are stable across cohort cycles — only the column headers change.
const COL = {
  day:       0,
  // Historical Wharton cohorts (raw enrollment) — columns shifted as new cohorts were added
  wHist1:   18, wHist2: 19, wHist3: 20, wHist4: 21, wHist5: 22, wHist6: 23,
  // Active Wharton cohort: Spring '26 - actual (col 24); Fall '26 - actual (col 25, mostly empty)
  wActual:  24, wForecast: 25,
  // Historical CBSEE cohorts
  cHist1:   28, cHist2: 29, cHist3: 30,
  // Active CBSEE cohort: Summer '26 - actual (col 31) and forecast (col 32)
  cActual:  31, cForecast: 32,
} as const;

const HIST_W_COLS = [COL.wHist1, COL.wHist2, COL.wHist3, COL.wHist4, COL.wHist5, COL.wHist6];
const HIST_C_COLS = [COL.cHist1, COL.cHist2, COL.cHist3];

export async function getPacingData(sheetId?: string): Promise<{
  summary: CohortSummary[];
  pacing: PacingDataPoint[];
  comparison: { wharton: ComparisonPanel; cbsee: ComparisonPanel | null };
  programs: string[];
}> {
  if (isDemo()) return getDemoPacing();

  const resolvedId = sheetId ?? process.env.GOOGLE_PACING_SHEET_ID;
  if (!resolvedId) throw new Error('No pacing sheet ID — set GOOGLE_PACING_SHEET_ID or pass sheetId');

  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const tab = 'Overall Cohort - AN Summary';

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: resolvedId,
    range: `'${tab}'!A1:AH200`,
  });
  const rows = res.data.values ?? [];

  // --- Find the "Days" header row ---
  const headerIdx = rows.findIndex(r => r[0]?.toString().trim() === 'Days');
  if (headerIdx < 0) throw new Error(`"Days" header row not found in tab "${tab}"`);
  const dataRows = rows.slice(headerIdx + 1);

  // --- Read historical cohort labels from column headers ---
  const wHistLabels = HIST_W_COLS.map(col =>
    (rows[headerIdx]?.[col] ?? '').toString().replace(/\s*-\s*actual\s*$/i, '').trim()
  );
  const cHistLabels = HIST_C_COLS.map(col =>
    (rows[headerIdx]?.[col] ?? '').toString().replace(/\s*-\s*actual\s*$/i, '').trim()
  );

  // --- Find first row with data for each program (rows are day-0-first, so first hit = most recent) ---
  let wIdx = -1;
  for (let i = 0; i < dataRows.length; i++) {
    if (N(dataRows[i]?.[COL.wActual]) !== null) { wIdx = i; break; }
  }
  let cIdx = -1;
  for (let i = 0; i < dataRows.length; i++) {
    if (N(dataRows[i]?.[COL.cActual]) !== null) { cIdx = i; break; }
  }

  // --- Active cohort names from column headers ---
  const wCohortName = (rows[headerIdx]?.[COL.wActual] ?? '')
    .toString().replace(/\s*-\s*actual\s*$/i, '').trim() || "Wharton Fall '26";
  const cCohortName = (rows[headerIdx]?.[COL.cActual] ?? '')
    .toString().replace(/\s*-\s*actual\s*$/i, '').trim() || "CBSEE Spring '26";

  const hasCBSEE = cIdx >= 0;
  const programs = hasCBSEE ? ['wharton', 'cbsee'] : ['wharton'];

  // --- Goals for active cohorts ---
  // Prefer the W_GOALS/C_GOALS lookup (keyed by cohort name from header) so goals
  // stay correct even when the forecast column is empty or carries a different cohort.
  const wGoal = getWGoal(wCohortName) ?? N(dataRows[0]?.[COL.wForecast]) ?? 1225;
  const cGoal = hasCBSEE ? (getCGoal(cCohortName) ?? N(dataRows[0]?.[COL.cForecast]) ?? 485) : 485;

  const wRow = wIdx >= 0 ? dataRows[wIdx] : null;
  const cRow = cIdx >= 0 ? dataRows[cIdx] : null;

  const wDays     = N(wRow?.[COL.day]) ?? 0;
  const wEnrolled = N(wRow?.[COL.wActual]) ?? 0;
  const wFc       = N(wRow?.[COL.wForecast]) ?? 0;

  const cDays     = N(cRow?.[COL.day]) ?? 0;
  const cEnrolled = N(cRow?.[COL.cActual]) ?? 0;
  const cFc       = N(cRow?.[COL.cForecast]) ?? 0;

  // histAvg: average raw enrollment of last 3 historical cohorts at current days remaining
  const wHistAvg = (() => {
    const last3Cols = HIST_W_COLS.slice(-3);
    const vals = last3Cols.map(col => N(wRow?.[col]) ?? 0);
    return Math.round(vals.reduce((s, v) => s + v, 0) / 3);
  })();
  const cHistAvg = hasCBSEE ? (() => {
    const vals = HIST_C_COLS.map(col => N(cRow?.[col]) ?? 0);
    return Math.round(vals.reduce((s, v) => s + v, 0) / 3);
  })() : 0;

  const wPct = wGoal > 0 ? (wEnrolled / wGoal * 100).toFixed(1) : '0.0';
  const cPct = cGoal > 0 ? (cEnrolled / cGoal * 100).toFixed(1) : '0.0';

  const summary: CohortSummary[] = [
    {
      cohort: wCohortName,
      program: 'Wharton',
      goal: wGoal,
      enrolled: wEnrolled,
      forecast: wFc,
      daysRemaining: wDays,
      histAvg: wHistAvg,
      keyTakeaway: `${wCohortName} has enrolled ${wEnrolled.toLocaleString()} of ${wGoal.toLocaleString()} students (${wPct}%) with ${wDays} days remaining, ${wEnrolled < wFc ? `falling ${wFc - wEnrolled} short of forecast` : `running ${wEnrolled - wFc} ahead of forecast`} and ${wEnrolled > wHistAvg ? `+${wEnrolled - wHistAvg}` : `${wEnrolled - wHistAvg}`} vs. the last 3-cohort average of ${wHistAvg.toLocaleString()}.`,
    },
    ...(hasCBSEE ? [{
      cohort: cCohortName,
      program: 'CBSEE',
      goal: cGoal,
      enrolled: cEnrolled,
      forecast: cFc,
      daysRemaining: cDays,
      histAvg: cHistAvg,
      keyTakeaway: `${cCohortName} has enrolled ${cEnrolled.toLocaleString()} of ${cGoal.toLocaleString()} students (${cPct}%) with ${cDays} days remaining, ${cEnrolled < cFc ? `falling ${cFc - cEnrolled} short of forecast` : `running ${cEnrolled - cFc} ahead of forecast`} and ${cEnrolled > cHistAvg ? `+${cEnrolled - cHistAvg}` : `${cEnrolled - cHistAvg}`} vs. the last 3-cohort average of ${cHistAvg.toLocaleString()}.`,
    }] : []),
  ];

  // --- Build pacing series ---
  const pacing: PacingDataPoint[] = dataRows
    .filter(r => r[COL.day] !== undefined && r[COL.day] !== '')
    .map(r => {
      const pt: PacingDataPoint = {
        day: N(r[COL.day]) ?? 0,
        wHistoricals: HIST_W_COLS.map((col, i) => {
          const label = wHistLabels[i];
          if (!label) return null;
          const v = N(r[col]);
          if (v === null) return null;
          const goal = getWGoal(label);
          if (!goal) return null;
          return { label, pct: +(v / goal * 100).toFixed(2) };
        }).filter((x): x is { label: string; pct: number } => x !== null),
        cHistoricals: hasCBSEE ? HIST_C_COLS.map((col, i) => {
          const label = cHistLabels[i];
          if (!label) return null;
          const v = N(r[col]);
          if (v === null) return null;
          const goal = getCGoal(label);
          if (!goal) return null;
          return { label, pct: +(v / goal * 100).toFixed(2) };
        }).filter((x): x is { label: string; pct: number } => x !== null) : [],
      };

      // Active cohort fields
      const wa = N(r[COL.wActual]);
      if (wa !== null && wGoal > 0) {
        pt.wActualPct = +(wa / wGoal * 100).toFixed(2);
        pt.wActual = wa;
      }
      const wf = N(r[COL.wForecast]);
      if (wf !== null) pt.wForecast = wf;

      if (hasCBSEE) {
        const ca = N(r[COL.cActual]);
        if (ca !== null && cGoal > 0) {
          pt.cActualPct = +(ca / cGoal * 100).toFixed(2);
          pt.cActual = ca;
        }
        const cf = N(r[COL.cForecast]);
        if (cf !== null) pt.cForecast = cf;
      }

      // Last 3 avg — most recent 3 historical cohorts
      if (pt.wHistoricals.length >= 3) {
        const last3 = pt.wHistoricals.slice(-3);
        pt.wLast3Pct = +(last3.reduce((s, h) => s + h.pct, 0) / 3).toFixed(2);
      }
      if (hasCBSEE && pt.cHistoricals.length >= 3) {
        const last3 = pt.cHistoricals.slice(-3);
        pt.cLast3Pct = +(last3.reduce((s, h) => s + h.pct, 0) / 3).toFixed(2);
      }

      return pt;
    });

  // Fill missing cForecast values near deadline using last-3-avg pace
  if (hasCBSEE) {
    for (const pt of pacing) {
      if (pt.cForecast === undefined && pt.cLast3Pct !== undefined) {
        pt.cForecast = Math.round(pt.cLast3Pct / 100 * cGoal);
      }
    }
  }

  // --- Comparison panels ---
  const findRowAtDay = (targetDay: number) =>
    pacing.reduce((best, pt) =>
      Math.abs(pt.day - targetDay) < Math.abs(best.day - targetDay) ? pt : best
    , pacing[0]);

  const buildPanel = (
    program: string,
    daysRem: number,
    activeLabel: string,
    enrolled: number,
    goal: number,
    historicals: Array<{ label: string; pct: number }>,
    goalFn: (label: string) => number | null
  ): ComparisonPanel => {
    const last3 = historicals.slice(-3);
    const last3AvgPct = last3.length > 0
      ? +(last3.reduce((s, h) => s + h.pct, 0) / last3.length).toFixed(1) : 0;
    const last3GoalAvg = last3.length > 0
      ? Math.round(last3.reduce((s, h) => s + (goalFn(h.label) ?? 0), 0) / last3.length) : 0;

    return {
      program,
      daysRemaining: daysRem,
      activeRow: {
        label: activeLabel,
        enrolled,
        goal,
        pctDone: goal > 0 ? +(enrolled / goal * 100).toFixed(1) : 0,
        isActive: true,
      },
      last3Avg: {
        enrolled: Math.round(last3AvgPct / 100 * last3GoalAvg),
        goal: last3GoalAvg,
        pctDone: last3AvgPct,
      },
      closedRows: [...historicals].reverse().map(h => {
        const g = goalFn(h.label) ?? 0;
        return {
          label: h.label,
          enrolled: Math.round(h.pct / 100 * g),
          goal: g,
          pctDone: +h.pct.toFixed(1),
          isActive: false,
        };
      }),
    };
  };

  const wAtDay = findRowAtDay(wDays);
  const wComparison = buildPanel(
    'Wharton Online', wDays, wCohortName, wEnrolled, wGoal,
    wAtDay.wHistoricals, getWGoal
  );

  let cbseeComparison: ComparisonPanel | null = null;
  if (hasCBSEE) {
    const cAtDay = findRowAtDay(cDays);
    cbseeComparison = buildPanel(
      'CBSEE', cDays, cCohortName, cEnrolled, cGoal,
      cAtDay.cHistoricals, getCGoal
    );
  }

  return {
    summary,
    pacing,
    comparison: { wharton: wComparison, cbsee: cbseeComparison },
    programs,
  };
}

// ---------------------------------------------------------------------------
// V2 reader — "Deadline Pacing Table V2" format
// Rows count DOWN from the enrollment deadline (row = "Day before Deadline").
// Compatible with the existing PacingChart because both use days-remaining as x.
// ---------------------------------------------------------------------------

const V2_TAB = 'Deadline Pacing Table V2';

// Column indices (0-based) in each data row of the V2 table
const V2 = {
  date:             0,  // "Current Date" — "M/D/YYYY"
  daysBeforeDeadline: 1, // "Day before Deadline"
  totalEnrollments: 21, // "Total Enrollments" (running cumulative actual)
  forecastEnrollments: 22, // "Forecast Enrollments"
  // Secondary section (repeated at far right for cleaner charting)
  goalCumulative:   28, // "Daily Goals" = cumulative goal by this day
  plus10:           30, // "Plus 10%"
  minus10:          31, // "Minus 10%"
} as const;

export async function getPacingDataV2(sheetId: string): Promise<{
  summary: CohortSummary[];
  pacing: PacingDataPoint[];
  comparison: { wharton: ComparisonPanel; cbsee: ComparisonPanel | null };
  programs: string[];
}> {
  if (isDemo()) return getDemoPacing();

  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${V2_TAB}'!A1:AF220`,
  });
  const rows = res.data.values ?? [];

  // --- Find header + data rows ---
  const hIdx = rows.findIndex(r => r[V2.daysBeforeDeadline] === 'Day before Deadline');
  if (hIdx < 0) throw new Error(`"Day before Deadline" header not found in "${V2_TAB}"`);

  const dataRows = rows
    .slice(hIdx + 1)
    .filter(r => r[V2.daysBeforeDeadline] !== undefined && r[V2.daysBeforeDeadline] !== '' && !isNaN(Number(r[V2.daysBeforeDeadline])));

  // --- Final goal: cumulative goal at day 0 (the deadline row) ---
  const deadlineRow = dataRows.find(r => N(r[V2.daysBeforeDeadline]) === 0);
  const finalGoal = N(deadlineRow?.[V2.goalCumulative]) ?? 1225;

  // --- Today's row: latest date in the sheet that is <= today ---
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const todayRow = dataRows.reduce<string[] | null>((best, r) => {
    const raw = r[V2.date];
    if (!raw) return best;
    const rowMs = new Date(raw).setHours(0, 0, 0, 0);
    if (isNaN(rowMs) || rowMs > todayMs) return best;
    if (!best) return r;
    const bestMs = new Date(best[V2.date]).setHours(0, 0, 0, 0);
    return rowMs > bestMs ? r : best;
  }, null);

  const daysRemaining = N(todayRow?.[V2.daysBeforeDeadline]) ?? 0;
  const currentEnrolled = N(todayRow?.[V2.totalEnrollments]) ?? 0;
  const currentGoalAtDay = N(todayRow?.[V2.goalCumulative]) ?? 0;
  const currentForecast = N(todayRow?.[V2.forecastEnrollments]) ?? 0;

  // --- Historical cohort enrollments from the summary section (rows 0-5 of sheet) ---
  const findSummaryVal = (keyword: string): number | null => {
    const row = rows.find(r =>
      r[0]?.toString().toLowerCase().includes(keyword.toLowerCase()) &&
      r[1] && r[1].toString().trim() !== ''
    );
    return row ? N(row[1]) : null;
  };
  const fall25Final  = findSummaryVal('fall 2025') ?? 883;
  const winter26Final = findSummaryVal('winter 2026') ?? 1020;
  const spring26Final = findSummaryVal('spring') ?? 1003; // "Spring 206" typo in sheet

  const histCohorts = [
    { label: "Fall '25",   enrolled: fall25Final,   goal: W_GOALS["Fall '25"]   ?? 897  },
    { label: "Winter '26", enrolled: winter26Final, goal: W_GOALS["Winter '26"] ?? 1021 },
    { label: "Spring '26", enrolled: spring26Final, goal: W_GOALS["Spring '26"] ?? 1225 },
  ];
  const last3AvgEnrolled = Math.round(histCohorts.reduce((s, c) => s + c.enrolled, 0) / histCohorts.length);
  const last3AvgGoal = Math.round(histCohorts.reduce((s, c) => s + c.goal, 0) / histCohorts.length);
  const last3AvgPct = +(histCohorts.reduce((s, c) => s + (c.enrolled / c.goal * 100), 0) / histCohorts.length).toFixed(1);

  // --- Summary ---
  const pctDone = finalGoal > 0 ? (currentEnrolled / finalGoal * 100).toFixed(1) : '0.0';
  const vsGoal = currentEnrolled - currentGoalAtDay;
  const keyTakeaway = `Wharton Fall '26 has enrolled ${currentEnrolled.toLocaleString()} of ${finalGoal.toLocaleString()} students (${pctDone}%) with ${daysRemaining} days remaining.${
    currentGoalAtDay > 0
      ? ` Goal pace: ${currentGoalAtDay.toLocaleString()} expected by this point (${vsGoal >= 0 ? '+' : ''}${vsGoal} vs pace). Last 3-cohort final avg: ${last3AvgEnrolled.toLocaleString()}.`
      : ''
  }`;

  const summary: CohortSummary[] = [{
    cohort: "Fall '26",
    program: 'Wharton',
    goal: finalGoal,
    enrolled: currentEnrolled,
    forecast: currentForecast > 0 ? currentForecast : finalGoal,
    daysRemaining,
    histAvg: last3AvgEnrolled,
    keyTakeaway,
  }];

  // --- Pacing data points ---
  // day = daysBeforeDeadline (days remaining), same convention as old format
  const pacing: PacingDataPoint[] = dataRows
    .filter(r => N(r[V2.daysBeforeDeadline]) !== null)
    .map(r => {
      const day = N(r[V2.daysBeforeDeadline])!;
      const cumulGoal = N(r[V2.goalCumulative]) ?? 0;

      const pt: PacingDataPoint = {
        day,
        // Goal trajectory stored as a single "historical" line so PacingChart renders it automatically
        wHistoricals: cumulGoal > 0
          ? [{ label: 'Goal Pace', pct: +(cumulGoal / finalGoal * 100).toFixed(2) }]
          : [],
        cHistoricals: [],
      };

      // Col 21 carries the current running total forward into future rows — only plot
      // actuals for dates that have already passed so the chart doesn't show a flat line
      // extending all the way to the deadline.
      const rowMs = new Date(r[V2.date]).setHours(0, 0, 0, 0);
      const isPast = !isNaN(rowMs) && rowMs <= todayMs;
      if (isPast) {
        const actuals = N(r[V2.totalEnrollments]) ?? 0;
        const forecast = N(r[V2.forecastEnrollments]);
        if (actuals > 0 && finalGoal > 0) {
          pt.wActualPct = +(actuals / finalGoal * 100).toFixed(2);
          pt.wActual = actuals;
        }
        if (forecast !== null && forecast > 0) pt.wForecast = forecast;
      }

      return pt;
    });

  // --- Comparison panel ---
  const wComparison: ComparisonPanel = {
    program: 'Wharton Online',
    daysRemaining,
    activeRow: {
      label: "Fall '26",
      enrolled: currentEnrolled,
      goal: finalGoal,
      pctDone: +(currentEnrolled / finalGoal * 100).toFixed(1),
      isActive: true,
    },
    last3Avg: {
      enrolled: last3AvgEnrolled,
      goal: last3AvgGoal,
      pctDone: last3AvgPct,
    },
    closedRows: [...histCohorts].reverse().map(c => ({
      label: c.label,
      enrolled: c.enrolled,
      goal: c.goal,
      pctDone: +(c.enrolled / c.goal * 100).toFixed(1),
      isActive: false,
    })),
  };

  return {
    summary,
    pacing,
    comparison: { wharton: wComparison, cbsee: null },
    programs: ['wharton'],
  };
}
