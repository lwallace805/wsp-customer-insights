import { google } from 'googleapis';
import { isDemo } from '@/lib/demo/flag';
import { getDemoPacing } from '@/lib/demo/enrollment';
import { nowET, getActiveCohort } from '@/lib/cohortCalendar';

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

// ─── Live goal read from the cohort performance doc ───────────────────────────
// The W_GOALS / C_GOALS maps above are the historical record; the ACTIVE cohort's
// goal is owned by its performance doc's goals tab, so it stays correct when
// leadership re-sets the target mid-cycle (Fall '26 went 1,225 → 1,100 that way).
// Layout is the same in both docs — a label in col A, the number in col B:
//   Wharton "Overall Goals" A2: "Fall 2026 Goal"   B2: 1,100
//   CBS     "Goals"         A3: "Spring 2026 Goal" B3: 468
// Matched by label (season + year + the word "Goal"), never by fixed cell, so an
// inserted row doesn't silently repoint us at the wrong number.

export interface DocGoal {
  goal: number;
  /** Provenance for the UI, e.g. `Overall Goals!B2 ("Fall 2026 Goal")`. */
  source: string;
}

/** Season+year matchers for a cohort — accepts the academic term name
 *  ("Fall 2026") and the marketing label ("Fall '26") for the same cohort. */
function goalLabelPatterns(labels: string[]): RegExp[] {
  const pats: RegExp[] = [];
  for (const l of labels) {
    const m = l.match(/(winter|spring|summer|fall)\D*(\d{2,4})/i);
    if (!m) continue;
    pats.push(new RegExp(`${m[1].toLowerCase()}\\s*'?(?:20)?${m[2].slice(-2)}\\b`, 'i'));
  }
  return pats;
}

/** The active cohort's goal as recorded in its performance doc. Returns null on
 *  any miss (tab absent, no matching row, non-numeric) so callers fall back. */
export async function readDocGoal(sheetId: string, tab: string, labels: string[]): Promise<DocGoal | null> {
  const pats = goalLabelPatterns(labels);
  if (pats.length === 0) return null;
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${tab}'!A1:B40`,
    });
    const rows = res.data.values ?? [];
    for (let i = 0; i < rows.length; i++) {
      const label = (rows[i]?.[0] ?? '').toString().trim();
      // Require the word "Goal" so historical reference rows in the same block
      // ("Winter 2026 | 485") can't be mistaken for the active cohort's target.
      if (!label || !/goal/i.test(label) || !pats.some(p => p.test(label))) continue;
      const goal = N(rows[i]?.[1]);
      if (goal === null || goal <= 0) continue;
      return { goal, source: `${tab}!B${i + 1} ("${label}")` };
    }
    return null;
  } catch {
    return null;
  }
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
  // Where `goal` came from (see readDocGoal) — surfaced in the UI so a goal change
  // in the performance doc is traceable rather than an unexplained number move.
  goalSource?: string;
  // Total of the deadline table's cumulative daily-goal curve. Equals `goal` when
  // the curve has been rebuilt for the current target; when it doesn't, the daily
  // goals are still on the old plan and that's worth showing.
  goalPlanTotal?: number;
}

export interface PacingDataPoint {
  day: number;
  // Dynamic historical % lines — ordered oldest→newest (matches column order in sheet).
  // Labels are read from the sheet header row so they self-update when cohorts rotate.
  // pct = % of that cohort's OWN eventual final total (pacing shape, not target progress) —
  // raw is the actual enrollment count that pct was derived from. "Goal Pace" entries
  // (V2 reader) aren't a real cohort and carry no raw.
  wHistoricals: Array<{ label: string; pct: number; raw?: number }>;
  cHistoricals: Array<{ label: string; pct: number; raw?: number }>;
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
  // % of goal = enrolled ÷ true target (meaningful only when `goal` is a real target,
  // not a backfilled final — see W_GOALS comment above).
  pctOfGoal: number;
  // % complete = enrolled ÷ this cohort's own eventual final total — the pacing metric,
  // always apples-to-apples across cohorts regardless of whether they hit their target.
  // Null for an in-progress active cohort, since its own eventual final isn't known yet.
  pctComplete: number | null;
  isActive: boolean;
}

export interface ComparisonPanel {
  program: string;
  daysRemaining: number;
  activeRow: ComparisonRow;
  last3Avg: { enrolled: number; goal: number; pctOfGoal: number; pctComplete: number | null };
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

  // Each historical column's own eventual final total (the day=0 row) — used as the
  // denominator for "% complete" (pacing), independent of whatever W_GOALS/C_GOALS record
  // as the target. Keeps pacing comparisons correct even when goal != actual final.
  const wOwnFinals = HIST_W_COLS.map(col => N(dataRows[0]?.[col]));
  const cOwnFinals = HIST_C_COLS.map(col => N(dataRows[0]?.[col]));

  // Verify the wForecast column is actually a forecast for the active Wharton cohort.
  // After Fall '26 was added, col 25 became "Wharton Fall '26 - actual" — reading it as
  // a forecast renders Fall '26 enrollment data as the Spring '26 forecast line.
  const wForecastHeader = (rows[headerIdx]?.[COL.wForecast] ?? '').toString().toLowerCase();
  const wForecastIsReal = wForecastHeader.includes('forecast') && !wForecastHeader.includes('actual');

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
  const wFc       = wForecastIsReal ? (N(wRow?.[COL.wForecast]) ?? 0) : 0;

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
      // Completed cohorts (daysRemaining=0) use the final goal as forecast so "vs. Goal Pace"
      // shows how far above/below goal the cohort actually finished.
      forecast: wFc > 0 ? wFc : (wDays === 0 ? wGoal : 0),
      daysRemaining: wDays,
      histAvg: wHistAvg,
      keyTakeaway: wDays === 0
        ? `${wCohortName} enrolled a final ${wEnrolled.toLocaleString()} of ${wGoal.toLocaleString()} students (${wPct}%)${wEnrolled >= wGoal ? `, exceeding goal by ${(wEnrolled - wGoal).toLocaleString()}` : `, finishing ${(wGoal - wEnrolled).toLocaleString()} short of goal`}. Last 3-cohort final avg: ${wHistAvg.toLocaleString()} (${wEnrolled > wHistAvg ? '+' : ''}${(wEnrolled - wHistAvg).toLocaleString()} vs avg).`
        : `${wCohortName} has enrolled ${wEnrolled.toLocaleString()} of ${wGoal.toLocaleString()} students (${wPct}%) with ${wDays} days remaining, ${wEnrolled < wFc ? `falling ${wFc - wEnrolled} short of forecast` : `running ${wEnrolled - wFc} ahead of forecast`} and ${wEnrolled > wHistAvg ? `+${wEnrolled - wHistAvg}` : `${wEnrolled - wHistAvg}`} vs. the last 3-cohort average of ${wHistAvg.toLocaleString()}.`,
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
          const ownFinal = wOwnFinals[i];
          if (!ownFinal) return null;
          return { label, pct: +(v / ownFinal * 100).toFixed(2), raw: v };
        }).filter((x): x is { label: string; pct: number; raw: number } => x !== null),
        cHistoricals: hasCBSEE ? HIST_C_COLS.map((col, i) => {
          const label = cHistLabels[i];
          if (!label) return null;
          const v = N(r[col]);
          if (v === null) return null;
          const ownFinal = cOwnFinals[i];
          if (!ownFinal) return null;
          return { label, pct: +(v / ownFinal * 100).toFixed(2), raw: v };
        }).filter((x): x is { label: string; pct: number; raw: number } => x !== null) : [],
      };

      // Active cohort fields
      const wa = N(r[COL.wActual]);
      if (wa !== null && wGoal > 0) {
        pt.wActualPct = +(wa / wGoal * 100).toFixed(2);
        pt.wActual = wa;
      }
      if (wForecastIsReal) {
        const wf = N(r[COL.wForecast]);
        if (wf !== null) pt.wForecast = wf;
      }

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
    historicals: Array<{ label: string; pct: number; raw?: number }>,
    goalFn: (label: string) => number | null
  ): ComparisonPanel => {
    // historicals[].pct is already "% of own eventual final" (pacing); goalFn gives the
    // true target for "% of goal" — kept separate since they only coincide when a cohort
    // hit its target exactly.
    const rows: ComparisonRow[] = historicals.slice(-3).map(h => {
      const raw = h.raw ?? 0;
      const g = goalFn(h.label) ?? 0;
      return {
        label: h.label,
        enrolled: raw,
        goal: g,
        pctOfGoal: g > 0 ? +(raw / g * 100).toFixed(1) : 0,
        pctComplete: +h.pct.toFixed(1),
        isActive: false,
      };
    });
    const avg = (fn: (r: ComparisonRow) => number) =>
      rows.length > 0 ? rows.reduce((s, r) => s + fn(r), 0) / rows.length : 0;

    return {
      program,
      daysRemaining: daysRem,
      activeRow: {
        label: activeLabel,
        enrolled,
        goal,
        pctOfGoal: goal > 0 ? +(enrolled / goal * 100).toFixed(1) : 0,
        // Own eventual final is only knowable once the cohort has actually closed.
        pctComplete: daysRem === 0 ? 100 : null,
        isActive: true,
      },
      last3Avg: {
        enrolled: Math.round(avg(r => r.enrolled)),
        goal: Math.round(avg(r => r.goal)),
        pctOfGoal: +avg(r => r.pctOfGoal).toFixed(1),
        pctComplete: +avg(r => r.pctComplete ?? 0).toFixed(1),
      },
      closedRows: [...rows].reverse(),
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
// Fetches historical Wharton cohort pacing from the V1 sheet (Overall Cohort - AN Summary)
// and returns a Map<daysRemaining → [{label, pct}]>. Used by the V2 reader to populate
// AllCohorts historical comparison lines without adding those columns to the V2 sheet.
// ---------------------------------------------------------------------------
async function fetchHistoricalWhartonMap(
  sheetId: string
): Promise<Map<number, Array<{ label: string; pct: number; raw: number }>>> {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'Overall Cohort - AN Summary'!A1:AH200`,
    });
    const rows = res.data.values ?? [];
    const hIdx = rows.findIndex(r => r[0]?.toString().trim() === 'Days');
    if (hIdx < 0) return new Map();

    // Col 24 ("Spring '26 - actual") is still labeled as the active column in this sheet
    // because it was never rotated after Fall '26 moved to its own V2 sheet — but Spring '26
    // is closed now, and its full day-by-day curve lives there. Treat it as historical too
    // so the V2/Fall '26 reader's "last 3 cohorts" includes Fall '25, Winter '26, AND Spring '26
    // instead of stalling one cohort behind. Update this list again next time a cohort closes.
    const histCols = [18, 19, 20, 21, 22, 23, 24] as const;
    const labels = histCols.map(col =>
      (rows[hIdx]?.[col] ?? '').toString().replace(/\s*-\s*actual\s*$/i, '').trim()
    );

    const dataRows = rows.slice(hIdx + 1);
    // pct is computed against each column's OWN eventual final (the day=0 row), not
    // W_GOALS — a cohort's recorded "goal" is often backfilled to equal its actual final
    // (see W_GOALS comment above), which would silently turn "% complete" into "% of goal"
    // for those columns. Reading the raw final straight from the sheet avoids that.
    const zeroRow = dataRows.find(r => Number(r[0]) === 0);
    const ownFinals = histCols.map(col => (zeroRow ? N(zeroRow[col]) : null));

    const map = new Map<number, Array<{ label: string; pct: number; raw: number }>>();
    for (const r of dataRows) {
      const day = r[0] ? Number(r[0]) : NaN;
      if (isNaN(day)) continue;
      const entries = histCols
        .map((col, i) => {
          const label = labels[i];
          if (!label) return null;
          const v = N(r[col]);
          if (v === null) return null;
          const ownFinal = ownFinals[i];
          if (!ownFinal) return null;
          return { label, pct: +(v / ownFinal * 100).toFixed(2), raw: v };
        })
        .filter((x): x is { label: string; pct: number; raw: number } => x !== null);
      if (entries.length > 0) map.set(day, entries);
    }
    return map;
  } catch {
    return new Map();
  }
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

export async function getPacingDataV2(
  sheetId: string,
  opts: { goalsTab?: string; cohortLabels?: string[] } = {},
): Promise<{
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

  // --- Final goal ---
  // Authoritative source is the doc's goals tab (leadership edits it there); the
  // deadline table's cumulative daily-goal curve is the fallback, and it lags a
  // re-set target because the per-day plan has to be rebuilt by hand.
  const deadlineRow = dataRows.find(r => N(r[V2.daysBeforeDeadline]) === 0);
  const goalPlanTotal = N(deadlineRow?.[V2.goalCumulative]);
  const activeWharton = getActiveCohort('wharton');
  const goalLabels = opts.cohortLabels
    ?? (activeWharton ? [activeWharton.termLabel, activeWharton.label] : ["Fall '26", 'Fall 2026']);
  const docGoal = await readDocGoal(sheetId, opts.goalsTab ?? 'Overall Goals', goalLabels);
  const finalGoal = docGoal?.goal ?? goalPlanTotal ?? 1225;
  const goalSource = docGoal
    ? docGoal.source
    : goalPlanTotal !== null
      ? `${V2_TAB} — cumulative Daily Goals at the deadline row`
      : 'built-in default (no goal found in the sheet)';

  // --- Today's row: latest date in the sheet that is <= today ---
  // Business day boundary is Eastern time — on UTC servers, local midnight flips
  // at 8pm ET, which advanced todayRow a day early every evening. nowET() carries
  // the ET wall clock in local fields, so setHours(0,0,0,0) lands on the same ms
  // basis as the row dates parsed by new Date("M/D/YYYY").
  const todayMs = nowET().setHours(0, 0, 0, 0);
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
  const currentForecast = N(todayRow?.[V2.forecastEnrollments]) ?? 0;

  // Enrollment counts reflect prior-day totals (1-day data lag). Compare against
  // yesterday's Forecast Enrollments (col 22) — what the model predicted would be
  // enrolled by end of that day — so the vs-pace delta is apples-to-apples.
  // Col 28 (Daily Goals) is a separate cumulative plan used only for the pacing chart.
  const yesterdayMs = todayMs - 86400000;
  const yesterdayRow = dataRows.reduce<string[] | null>((best, r) => {
    const raw = r[V2.date];
    if (!raw) return best;
    const rowMs = new Date(raw).setHours(0, 0, 0, 0);
    if (isNaN(rowMs) || rowMs > yesterdayMs) return best;
    if (!best) return r;
    return rowMs > new Date(best[V2.date]).setHours(0, 0, 0, 0) ? r : best;
  }, null);
  const currentGoalAtDay = N(yesterdayRow?.[V2.forecastEnrollments]) ?? N(todayRow?.[V2.forecastEnrollments]) ?? 0;

  // --- Historical cohort comparison, at the SAME days-remaining point Fall '26 is at now ---
  // Pulled from the V1 sheet's per-day historical columns (see fetchHistoricalWhartonMap)
  // so "Closed Cohorts" and "vs. Last 3 cohort avg" are apples-to-apples with Fall '26's
  // current pace, not each cohort's fully-finished final total.
  const historicalSheetId = process.env.GOOGLE_PACING_SHEET_ID;
  const historicalMap = historicalSheetId ? await fetchHistoricalWhartonMap(historicalSheetId) : new Map<number, Array<{ label: string; pct: number; raw: number }>>();

  const findHistEntriesAtDay = (targetDay: number): Array<{ label: string; pct: number; raw: number }> => {
    let bestDay: number | null = null;
    for (const day of historicalMap.keys()) {
      if (bestDay === null || Math.abs(day - targetDay) < Math.abs(bestDay - targetDay)) bestDay = day;
    }
    return bestDay !== null ? historicalMap.get(bestDay)! : [];
  };
  const last3AtDay = findHistEntriesAtDay(daysRemaining).slice(-3);

  // Fallback (V1 sheet unreachable, or fewer than 3 cohorts found there): use each
  // cohort's fully-finished final total from the V2 sheet's summary block. Since these
  // are already-final totals, pctComplete is trivially 100 (there's no day-by-day curve
  // to compute pace from in this fallback path).
  const findSummaryVal = (keyword: string): number | null => {
    const row = rows.find(r =>
      r[0]?.toString().toLowerCase().includes(keyword.toLowerCase()) &&
      r[1] && r[1].toString().trim() !== ''
    );
    return row ? N(row[1]) : null;
  };

  const histCohorts: Array<{ label: string; enrolled: number; goal: number; pctOfGoal: number; pctComplete: number }> =
    last3AtDay.length === 3
      ? last3AtDay.map(h => {
          const goal = getWGoal(h.label) ?? 0;
          return {
            label: h.label,
            enrolled: h.raw,
            goal,
            pctOfGoal: goal > 0 ? +(h.raw / goal * 100).toFixed(1) : 0,
            pctComplete: +h.pct.toFixed(1),
          };
        })
      : ([
          { label: "Fall '25",   enrolled: findSummaryVal('fall 2025') ?? 883,    goal: W_GOALS["Fall '25"]   ?? 897  },
          { label: "Winter '26", enrolled: findSummaryVal('winter 2026') ?? 1020, goal: W_GOALS["Winter '26"] ?? 1021 },
          { label: "Spring '26", enrolled: findSummaryVal('spring') ?? 1003,      goal: W_GOALS["Spring '26"] ?? 1225 }, // "Spring 206" typo in sheet
        ]).map(c => ({ ...c, pctOfGoal: c.goal > 0 ? +(c.enrolled / c.goal * 100).toFixed(1) : 0, pctComplete: 100 }));

  const avgHist = (fn: (c: (typeof histCohorts)[number]) => number) =>
    histCohorts.length > 0 ? histCohorts.reduce((s, c) => s + fn(c), 0) / histCohorts.length : 0;
  const last3AvgEnrolled = Math.round(avgHist(c => c.enrolled));
  const last3AvgGoal = Math.round(avgHist(c => c.goal));
  const last3AvgPctOfGoal = +avgHist(c => c.pctOfGoal).toFixed(1);
  const last3AvgPctComplete = +avgHist(c => c.pctComplete).toFixed(1);

  // --- Summary ---
  const pctDone = finalGoal > 0 ? (currentEnrolled / finalGoal * 100).toFixed(1) : '0.0';
  const vsGoal = currentEnrolled - currentGoalAtDay;
  const keyTakeaway = `Wharton Fall '26 has enrolled ${currentEnrolled.toLocaleString()} of ${finalGoal.toLocaleString()} students (${pctDone}%) with ${daysRemaining} days remaining.${
    currentGoalAtDay > 0
      ? ` Goal pace: ${currentGoalAtDay.toLocaleString()} expected by this point (${vsGoal >= 0 ? '+' : ''}${vsGoal} vs pace). Last 3-cohort avg at this point: ${last3AvgEnrolled.toLocaleString()}.`
      : ''
  }`;

  const summary: CohortSummary[] = [{
    cohort: "Fall '26",
    program: 'Wharton',
    goal: finalGoal,
    enrolled: currentEnrolled,
    // Use the goal-pace value (cumulative goal trajectory) as the forecast baseline so
    // "vs. Forecast" in the stat card reflects where the enrollment plan says we should be,
    // not a statistical model projection from a different column.
    forecast: currentGoalAtDay > 0 ? currentGoalAtDay : currentForecast > 0 ? currentForecast : finalGoal,
    daysRemaining,
    histAvg: last3AvgEnrolled,
    keyTakeaway,
    goalSource,
    goalPlanTotal: goalPlanTotal ?? undefined,
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
        // Goal trajectory stored as a single "historical" line so PacingChart renders it automatically.
        // Normalized by the curve's OWN total, not the goal — the useful signal is the plan's shape
        // ("what share of target should be in by day N"), and dividing a curve built for an old
        // target by the new goal would run the plan line past 100% at the deadline.
        wHistoricals: cumulGoal > 0
          ? [{ label: 'Goal Pace', pct: +(cumulGoal / (goalPlanTotal || finalGoal) * 100).toFixed(2) }]
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

  // --- Merge historical cohort lines from V1 sheet ---
  // The V2 sheet only has Goal Pace; historical cohort curves live in the V1 sheet (cols 18-24).
  // Both sheets use daysBeforeDeadline as the x-axis, so we can join them directly.
  // (historicalMap was already fetched above for the histCohorts comparison.)
  if (historicalMap.size > 0) {
    for (const pt of pacing) {
      const hist = historicalMap.get(pt.day);
      if (hist && hist.length > 0) {
        // Prepend historical cohort lines before "Goal Pace" so the legend order is oldest→newest→Goal Pace
        pt.wHistoricals = [...hist, ...pt.wHistoricals];
        // Recompute last-3 average using only cohort lines, not Goal Pace
        const cohortLines = pt.wHistoricals.filter(h => h.label !== 'Goal Pace');
        if (cohortLines.length >= 3) {
          const last3 = cohortLines.slice(-3);
          pt.wLast3Pct = +(last3.reduce((s, h) => s + h.pct, 0) / 3).toFixed(2);
        }
      }
    }
  }

  // --- Comparison panel ---
  const wComparison: ComparisonPanel = {
    program: 'Wharton Online',
    daysRemaining,
    activeRow: {
      label: "Fall '26",
      enrolled: currentEnrolled,
      goal: finalGoal,
      pctOfGoal: +(currentEnrolled / finalGoal * 100).toFixed(1),
      // Fall '26 is still in progress — its own eventual final isn't known yet.
      pctComplete: daysRemaining === 0 ? 100 : null,
      isActive: true,
    },
    last3Avg: {
      enrolled: last3AvgEnrolled,
      goal: last3AvgGoal,
      pctOfGoal: last3AvgPctOfGoal,
      pctComplete: last3AvgPctComplete,
    },
    closedRows: [...histCohorts].reverse().map(c => ({
      label: c.label,
      enrolled: c.enrolled,
      goal: c.goal,
      pctOfGoal: c.pctOfGoal,
      pctComplete: c.pctComplete,
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
