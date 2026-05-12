import { google } from 'googleapis';

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

function getPacingSheetId() {
  const id = process.env.GOOGLE_PACING_SHEET_ID;
  if (!id) throw new Error('GOOGLE_PACING_SHEET_ID is not set');
  return id;
}

// Strip commas/percent signs and parse to number; returns null if blank/invalid
function N(v: string | undefined | null): number | null {
  if (!v || v.trim() === '' || v === '#DIV/0!' || v === '#REF!') return null;
  const n = parseFloat(v.replace(/,/g, '').replace(/%/g, '').trim());
  return isNaN(n) ? null : n;
}

// Historical cohort goals (used to convert raw enrollment → % completion)
const W_GOALS = { wSp24: 1058, wFa24: 1154, wWi25: 1191, wSp25: 1035, wFa25: 897, wWi26: 1021 };
const C_GOALS = { cSu25: 415, cFa25: 468, cWi26: 485 };

export interface CohortSummary {
  cohort: string;
  program: string;
  goal: number;
  enrolled: number;
  forecast: number;
  daysRemaining: number;
  histAvg: number; // avg of last 3 completed cohorts at same days-remaining point
  keyTakeaway: string;
}

export interface PacingDataPoint {
  day: number; // days remaining (0 = enrollment deadline, 120 = start)
  // % completion (enrolled/goal * 100) — for pacing charts
  wSp24Pct?: number;
  wFa24Pct?: number;
  wWi25Pct?: number;
  wSp25Pct?: number;
  wFa25Pct?: number;
  wWi26Pct?: number;
  wActualPct?: number;
  wLast3Pct?: number;
  cSu25Pct?: number;
  cFa25Pct?: number;
  cWi26Pct?: number;
  cActualPct?: number;
  cLast3Pct?: number;
  // Raw enrollment — for forecast charts
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

// Column indices (0-based) in the "Overall Cohort - AN Summary" pacing table
const COL = {
  day:       0,
  wSp24:    17,
  wFa24:    18,
  wWi25:    19,
  wSp25:    20,
  wFa25:    21,
  wWi26:    22,
  wActual:  23,
  wForecast:24,
  cSu25:    26,
  cFa25:    27,
  cWi26:    28,
  cActual:  29,
  cForecast:30,
} as const;

export async function getPacingData(): Promise<{
  summary: CohortSummary[];
  pacing: PacingDataPoint[];
  comparison: { wharton: ComparisonPanel; cbsee: ComparisonPanel };
}> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = getPacingSheetId();
  const tab = 'Overall Cohort - AN Summary';

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tab}'!A1:AH200`,
  });
  const rows = res.data.values ?? [];

  // --- Find the "Days" header row ---
  const headerIdx = rows.findIndex(r => r[0]?.toString().trim() === 'Days');
  if (headerIdx < 0) throw new Error(`"Days" header row not found in tab "${tab}"`);
  const dataRows = rows.slice(headerIdx + 1);

  // --- Find first (minimum days-remaining) row with actual data for each program ---
  let wIdx = -1;
  for (let i = 0; i < dataRows.length; i++) {
    if (N(dataRows[i]?.[COL.wActual]) !== null) { wIdx = i; break; }
  }
  let cIdx = -1;
  for (let i = 0; i < dataRows.length; i++) {
    if (N(dataRows[i]?.[COL.cActual]) !== null) { cIdx = i; break; }
  }

  // --- Read active cohort names from summary section (before the Days header) ---
  const wSummaryRow = rows.slice(0, headerIdx).find(
    r => r[2]?.toString().includes('Wharton') && r[5]?.toString().trim() === '0%'
  );
  const cSummaryRow = rows.slice(0, headerIdx).find(
    r => r[2]?.toString().includes('CBSEE') && r[5]?.toString().trim() === '0%'
  );
  const wCohortName = wSummaryRow?.[2]?.toString().trim() ?? "Wharton Spring '26";
  const cCohortName = cSummaryRow?.[2]?.toString().trim() ?? "CBSEE Winter '26";

  // --- Build summary cards ---
  const wRow = wIdx >= 0 ? dataRows[wIdx] : null;
  const cRow = cIdx >= 0 ? dataRows[cIdx] : null;

  const wGoal = N(dataRows[0]?.[COL.wForecast]) ?? 1225;
  const cGoal = N(cSummaryRow?.[3]) ?? 468;

  const wDays    = N(wRow?.[COL.day]) ?? 0;
  const wEnrolled = N(wRow?.[COL.wActual]) ?? 0;
  const wFc      = N(wRow?.[COL.wForecast]) ?? 0;
  const wSp25at  = N(wRow?.[COL.wSp25]) ?? 0;
  const wFa25at  = N(wRow?.[COL.wFa25]) ?? 0;
  const wWi26at  = N(wRow?.[COL.wWi26]) ?? 0;
  const wHistAvg = Math.round((wSp25at + wFa25at + wWi26at) / 3);

  const cDays    = N(cRow?.[COL.day]) ?? 0;
  const cEnrolled = N(cRow?.[COL.cActual]) ?? 0;
  const cFc      = N(cRow?.[COL.cForecast]) ?? 0;
  const cSu25at  = N(cRow?.[COL.cSu25]) ?? 0;
  const cFa25at  = N(cRow?.[COL.cFa25]) ?? 0;
  const cWi26at  = N(cRow?.[COL.cWi26]) ?? 0;
  const cHistAvg = Math.round((cSu25at + cFa25at + cWi26at) / 3);

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
    {
      cohort: cCohortName,
      program: 'CBSEE',
      goal: cGoal,
      enrolled: cEnrolled,
      forecast: cFc,
      daysRemaining: cDays,
      histAvg: cHistAvg,
      keyTakeaway: `${cCohortName} has enrolled ${cEnrolled.toLocaleString()} of ${cGoal.toLocaleString()} students (${cPct}%) with ${cDays} days remaining, ${cEnrolled < cFc ? `falling ${cFc - cEnrolled} short of forecast` : `running ${cEnrolled - cFc} ahead of forecast`} and ${cEnrolled > cHistAvg ? `+${cEnrolled - cHistAvg}` : `${cEnrolled - cHistAvg}`} vs. the last 3-cohort average of ${cHistAvg.toLocaleString()}.`,
    },
  ];

  // --- Build pacing series with % fields ---
  const pacing: PacingDataPoint[] = dataRows
    .filter(r => r[COL.day] !== undefined && r[COL.day] !== '')
    .map(r => {
      const pt: PacingDataPoint = { day: N(r[COL.day]) ?? 0 };

      const getRaw = (colIdx: number) => N(r[colIdx]);

      // Helper to set % field
      const setPct = (key: keyof PacingDataPoint, colIdx: number, goal: number) => {
        const v = getRaw(colIdx);
        if (v !== null && goal > 0) {
          (pt as unknown as Record<string, number>)[key] = parseFloat((v / goal * 100).toFixed(2));
        }
      };

      // Historical % fields
      setPct('wSp24Pct', COL.wSp24, W_GOALS.wSp24);
      setPct('wFa24Pct', COL.wFa24, W_GOALS.wFa24);
      setPct('wWi25Pct', COL.wWi25, W_GOALS.wWi25);
      setPct('wSp25Pct', COL.wSp25, W_GOALS.wSp25);
      setPct('wFa25Pct', COL.wFa25, W_GOALS.wFa25);
      setPct('wWi26Pct', COL.wWi26, W_GOALS.wWi26);
      setPct('cSu25Pct', COL.cSu25, C_GOALS.cSu25);
      setPct('cFa25Pct', COL.cFa25, C_GOALS.cFa25);
      setPct('cWi26Pct', COL.cWi26, C_GOALS.cWi26);

      // Active cohort % fields
      setPct('wActualPct', COL.wActual, wGoal);
      setPct('cActualPct', COL.cActual, cGoal);

      // Compute last3 avg for Wharton (wSp25, wFa25, wWi26)
      const wsp25 = pt.wSp25Pct;
      const wfa25 = pt.wFa25Pct;
      const wwi26 = pt.wWi26Pct;
      if (wsp25 !== undefined && wfa25 !== undefined && wwi26 !== undefined) {
        pt.wLast3Pct = parseFloat(((wsp25 + wfa25 + wwi26) / 3).toFixed(2));
      }

      // Compute last3 avg for CBSEE (cSu25, cFa25, cWi26)
      const csu25 = pt.cSu25Pct;
      const cfa25 = pt.cFa25Pct;
      const cwi26 = pt.cWi26Pct;
      if (csu25 !== undefined && cfa25 !== undefined && cwi26 !== undefined) {
        pt.cLast3Pct = parseFloat(((csu25 + cfa25 + cwi26) / 3).toFixed(2));
      }

      // Raw enrollment for forecast charts
      const wa = getRaw(COL.wActual);
      if (wa !== null) pt.wActual = wa;
      const wf = getRaw(COL.wForecast);
      if (wf !== null) pt.wForecast = wf;
      const ca = getRaw(COL.cActual);
      if (ca !== null) pt.cActual = ca;
      const cf = getRaw(COL.cForecast);
      if (cf !== null) pt.cForecast = cf;

      return pt;
    });

  // --- Build comparison panels ---
  // Find the pacing row closest to each program's current days remaining
  const findRowAtDay = (targetDay: number) =>
    pacing.reduce((best, pt) =>
      Math.abs(pt.day - targetDay) < Math.abs(best.day - targetDay) ? pt : best
    , pacing[0]);

  const wAtDay = findRowAtDay(wDays);
  const cAtDay = findRowAtDay(cDays);

  const wComparison: ComparisonPanel = {
    program: 'Wharton Online',
    daysRemaining: wDays,
    activeRow: {
      label: wCohortName,
      enrolled: wEnrolled,
      goal: wGoal,
      pctDone: wGoal > 0 ? parseFloat((wEnrolled / wGoal * 100).toFixed(1)) : 0,
      isActive: true,
    },
    last3Avg: (() => {
      const sp25 = wAtDay.wSp25Pct ?? 0;
      const fa25 = wAtDay.wFa25Pct ?? 0;
      const wi26 = wAtDay.wWi26Pct ?? 0;
      const avgPct = parseFloat(((sp25 + fa25 + wi26) / 3).toFixed(1));
      const avgGoal = Math.round((W_GOALS.wSp25 + W_GOALS.wFa25 + W_GOALS.wWi26) / 3);
      const avgEnrolled = Math.round(avgPct / 100 * avgGoal);
      return { enrolled: avgEnrolled, goal: avgGoal, pctDone: avgPct };
    })(),
    closedRows: [
      { label: "Winter '26", enrolled: Math.round((wAtDay.wWi26Pct ?? 0) / 100 * W_GOALS.wWi26), goal: W_GOALS.wWi26, pctDone: parseFloat((wAtDay.wWi26Pct ?? 0).toFixed(1)), isActive: false },
      { label: "Fall '25",   enrolled: Math.round((wAtDay.wFa25Pct ?? 0) / 100 * W_GOALS.wFa25), goal: W_GOALS.wFa25, pctDone: parseFloat((wAtDay.wFa25Pct ?? 0).toFixed(1)), isActive: false },
      { label: "Spring '25", enrolled: Math.round((wAtDay.wSp25Pct ?? 0) / 100 * W_GOALS.wSp25), goal: W_GOALS.wSp25, pctDone: parseFloat((wAtDay.wSp25Pct ?? 0).toFixed(1)), isActive: false },
      { label: "Winter '25", enrolled: Math.round((wAtDay.wWi25Pct ?? 0) / 100 * W_GOALS.wWi25), goal: W_GOALS.wWi25, pctDone: parseFloat((wAtDay.wWi25Pct ?? 0).toFixed(1)), isActive: false },
      { label: "Fall '24",   enrolled: Math.round((wAtDay.wFa24Pct ?? 0) / 100 * W_GOALS.wFa24), goal: W_GOALS.wFa24, pctDone: parseFloat((wAtDay.wFa24Pct ?? 0).toFixed(1)), isActive: false },
      { label: "Spring '24", enrolled: Math.round((wAtDay.wSp24Pct ?? 0) / 100 * W_GOALS.wSp24), goal: W_GOALS.wSp24, pctDone: parseFloat((wAtDay.wSp24Pct ?? 0).toFixed(1)), isActive: false },
    ],
  };

  const cComparison: ComparisonPanel = {
    program: 'CBSEE',
    daysRemaining: cDays,
    activeRow: {
      label: cCohortName,
      enrolled: cEnrolled,
      goal: cGoal,
      pctDone: cGoal > 0 ? parseFloat((cEnrolled / cGoal * 100).toFixed(1)) : 0,
      isActive: true,
    },
    last3Avg: (() => {
      const su25 = cAtDay.cSu25Pct ?? 0;
      const fa25 = cAtDay.cFa25Pct ?? 0;
      const wi26 = cAtDay.cWi26Pct ?? 0;
      const avgPct = parseFloat(((su25 + fa25 + wi26) / 3).toFixed(1));
      const avgGoal = Math.round((C_GOALS.cSu25 + C_GOALS.cFa25 + C_GOALS.cWi26) / 3);
      const avgEnrolled = Math.round(avgPct / 100 * avgGoal);
      return { enrolled: avgEnrolled, goal: avgGoal, pctDone: avgPct };
    })(),
    closedRows: [
      { label: "Winter '26", enrolled: Math.round((cAtDay.cWi26Pct ?? 0) / 100 * C_GOALS.cWi26), goal: C_GOALS.cWi26, pctDone: parseFloat((cAtDay.cWi26Pct ?? 0).toFixed(1)), isActive: false },
      { label: "Fall '25",   enrolled: Math.round((cAtDay.cFa25Pct ?? 0) / 100 * C_GOALS.cFa25), goal: C_GOALS.cFa25, pctDone: parseFloat((cAtDay.cFa25Pct ?? 0).toFixed(1)), isActive: false },
      { label: "Summer '25", enrolled: Math.round((cAtDay.cSu25Pct ?? 0) / 100 * C_GOALS.cSu25), goal: C_GOALS.cSu25, pctDone: parseFloat((cAtDay.cSu25Pct ?? 0).toFixed(1)), isActive: false },
    ],
  };

  return {
    summary,
    pacing,
    comparison: { wharton: wComparison, cbsee: cComparison },
  };
}
