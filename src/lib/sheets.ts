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
  // Wharton historical # enrollment at this day
  wSp24?: number;
  wFa24?: number;
  wWi25?: number;
  wSp25?: number;
  wFa25?: number;
  wWi26?: number;
  // Wharton active cohort
  wActual?: number;
  wForecast?: number;
  // CBSEE historical # enrollment at this day
  cSu25?: number;
  cFa25?: number;
  cWi26?: number;
  // CBSEE active cohort
  cActual?: number;
  cForecast?: number;
}

// Column indices (0-based) in the "Overall Cohort - AN Summary" pacing table
// These map to columns A, B, C... in the Google Sheet starting from the "Days" header row
const COL = {
  day:      0,
  // % completion columns (cols B–K): not used for summary cards, only for % chart if needed
  // Wharton # enrollment columns (cols R–Y, i.e. indices 17–24)
  wSp24:    17,
  wFa24:    18,
  wWi25:    19,
  wSp25:    20,
  wFa25:    21,
  wWi26:    22,
  wActual:  23, // "Wharton Spring '26 - actual"
  wForecast:24, // "Wharton Spring '26 - forecast"
  // CBSEE # enrollment columns (cols AA–AE, i.e. indices 26–30)
  cSu25:    26,
  cFa25:    27,
  cWi26:    28,
  cActual:  29, // "CBSEE Spring '26 - actual"
  cForecast:30, // "CBSEE Spring '26 - forecast"
} as const;

export async function getPacingData(): Promise<{ summary: CohortSummary[]; pacing: PacingDataPoint[] }> {
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
  // Search for the row with the Wharton active cohort goal (col[5] = "0%")
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

  // Goal = forecast at day 0 (the enrollment deadline maximum)
  const wGoal = N(dataRows[0]?.[COL.wForecast]) ?? 1225;
  // CBSEE goal: read from summary section col[3], fallback 468
  const cGoal = N(cSummaryRow?.[3]) ?? 468;

  const wDays   = N(wRow?.[COL.day]) ?? 0;
  const wEnrolled = N(wRow?.[COL.wActual]) ?? 0;
  const wFc     = N(wRow?.[COL.wForecast]) ?? 0;
  const wSp25at = N(wRow?.[COL.wSp25]) ?? 0;
  const wFa25at = N(wRow?.[COL.wFa25]) ?? 0;
  const wWi26at = N(wRow?.[COL.wWi26]) ?? 0;
  const wHistAvg = Math.round((wSp25at + wFa25at + wWi26at) / 3);

  const cDays   = N(cRow?.[COL.day]) ?? 0;
  const cEnrolled = N(cRow?.[COL.cActual]) ?? 0;
  const cFc     = N(cRow?.[COL.cForecast]) ?? 0;
  const cSu25at = N(cRow?.[COL.cSu25]) ?? 0;
  const cFa25at = N(cRow?.[COL.cFa25]) ?? 0;
  const cWi26at = N(cRow?.[COL.cWi26]) ?? 0;
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

  // --- Build pacing series (all data rows) ---
  const pacing: PacingDataPoint[] = dataRows
    .filter(r => r[COL.day] !== undefined && r[COL.day] !== '')
    .map(r => {
      const pt: PacingDataPoint = { day: N(r[COL.day]) ?? 0 };
      const set = (key: keyof PacingDataPoint, colIdx: number) => {
        const v = N(r[colIdx]);
        if (v !== null) (pt as Record<string, number>)[key] = v;
      };
      set('wSp24',    COL.wSp24);
      set('wFa24',    COL.wFa24);
      set('wWi25',    COL.wWi25);
      set('wSp25',    COL.wSp25);
      set('wFa25',    COL.wFa25);
      set('wWi26',    COL.wWi26);
      set('wActual',  COL.wActual);
      set('wForecast',COL.wForecast);
      set('cSu25',    COL.cSu25);
      set('cFa25',    COL.cFa25);
      set('cWi26',    COL.cWi26);
      set('cActual',  COL.cActual);
      set('cForecast',COL.cForecast);
      return pt;
    });

  return { summary, pacing };
}
