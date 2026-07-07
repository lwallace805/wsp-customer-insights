// ─── Enrollment team (Aubrey) live readers ────────────────────────────────────
//
// Reads the enrollment-team "Certifcates Dashboard" sheet. Tab map (verified
// against Aubrey's weekly email of 6/29/26):
//   - "Email Data"                        → advisor outreach by contact stage
//   - "Team Consult Data"                 → consults + consult→enroll CVR per
//                                           advisor, baseline vs actual (her
//                                           comparison-dates method)
//   - "Tuition Assistance Data"           → TA apps / enrollees / CVR
//   - "Info Session Data"                 → registrations + attendance by
//                                           session week vs prior cohorts
//   - "Enrollment KPIs/Goal Tracking - *" → weekly per-advisor KPI scoreboard
//
// Every reader fails soft (null section) so a restructured tab degrades to an
// "unavailable" card, never a crashed page.

import { google } from 'googleapis';

export const ENROLLMENT_TEAM_SHEET_ID = '1me1ls1tI9rsj0_4vYWu2qpX9E5k7L8aCz-8WvX00IwU';
const OUTREACH_TAB = 'Email Data';
const ADVISOR_NAMES = ['HAYLIE', 'KELIN', 'KRISTEN', 'ALICIA', 'MIKE'];

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

export function getServiceAccountEmail(): string | null {
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!raw) return null;
    return JSON.parse(raw).client_email ?? null;
  } catch {
    return null;
  }
}

function N(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === '' || s === '-' || s.startsWith('#')) return null;
  const n = parseFloat(s.replace(/[$,%]/g, '').replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function S(v: unknown): string {
  return String(v ?? '').trim();
}

async function readTab(tab: string, range = 'A1:BZ300'): Promise<string[][]> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: ENROLLMENT_TEAM_SHEET_ID,
    range: `'${tab.replace(/'/g, "''")}'!${range}`,
  });
  return (res.data.values ?? []) as string[][];
}

// ─── 1 · Advisor outreach ("Email Data") ──────────────────────────────────────

export interface AdvisorWeekRow {
  week: number;
  dateRange: string;
  perAdvisor: Record<string, { sent: number; closed: number | null }>;
}

export interface AdvisorCohortTotals {
  advisor: string;
  contactSent: number | null;
  leadSent: number | null;
  qualifiedSent: number | null;
  customerSent: number | null;
  totalSent: number | null;
  closed: number | null;
}

export interface OutreachBlock {
  cohortLabel: string;
  totals: AdvisorCohortTotals[];
  weeks: AdvisorWeekRow[];
}

export interface OutreachData {
  blocks: OutreachBlock[];
}

async function readOutreach(): Promise<OutreachData | null> {
  try {
    const rows = await readTab(OUTREACH_TAB);
    const aIdx = rows.findIndex(r =>
      r.filter(c => ADVISOR_NAMES.includes(S(c).toUpperCase())).length >= 2
    );
    if (aIdx < 0) return null;

    const advisorCols: Array<{ name: string; col: number }> = [];
    rows[aIdx].forEach((c, i) => {
      const name = S(c).toUpperCase();
      if (ADVISOR_NAMES.includes(name)) advisorCols.push({ name, col: i });
    });

    // Within each advisor block: Contact Sent +0, Lead Sent +2, A/Q Sent +4,
    // Customer Sent +6, Total +8, Closed +9.
    const readAdvisorCells = (r: string[]) =>
      advisorCols.map(a => ({
        advisor: a.name,
        contactSent: N(r[a.col]),
        leadSent: N(r[a.col + 2]),
        qualifiedSent: N(r[a.col + 4]),
        customerSent: N(r[a.col + 6]),
        totalSent: N(r[a.col + 8]),
        closed: N(r[a.col + 9]),
      }));

    const blocks: OutreachBlock[] = [];
    let current: OutreachBlock | null = null;
    for (const r of rows.slice(aIdx + 1)) {
      const c0 = S(r[0]);
      const weekMatch = c0.match(/^Week\s+(\d+)/i);
      if (weekMatch && current) {
        const perAdvisor: AdvisorWeekRow['perAdvisor'] = {};
        for (const a of readAdvisorCells(r)) {
          perAdvisor[a.advisor] = { sent: a.totalSent ?? 0, closed: a.closed };
        }
        current.weeks.push({ week: parseInt(weekMatch[1]), dateRange: S(r[1]), perAdvisor });
      } else if (/^(fall|spring|winter|summer)\s+20\d\d$/i.test(c0)) {
        current = { cohortLabel: c0, totals: readAdvisorCells(r), weeks: [] };
        blocks.push(current);
      }
    }
    return blocks.length ? { blocks } : null;
  } catch {
    return null;
  }
}

// ─── 2 · Consults ("Team Consult Data") ───────────────────────────────────────

export interface ConsultAdvisorBlock {
  advisor: string;
  // [baseline, actual] pairs
  columbia: { completed: [number | null, number | null]; enrollees: [number | null, number | null]; cvr: [number | null, number | null] };
  wharton: { completed: [number | null, number | null]; enrollees: [number | null, number | null]; cvr: [number | null, number | null] };
  combined: { completed: [number | null, number | null]; enrollees: [number | null, number | null]; cvr: [number | null, number | null] };
}

export interface ConsultsData {
  dataPulled: string | null;
  comparisonNote: string | null;
  advisors: ConsultAdvisorBlock[];  // includes the "Total" block last
}

async function readConsults(): Promise<ConsultsData | null> {
  try {
    const rows = await readTab('Team Consult Data');
    const hIdx = rows.findIndex(r => S(r[1]) === 'Employee');
    if (hIdx < 0) return null;
    const header = rows[hIdx].map(c => S(c).toLowerCase());
    const aiCol = header.findIndex(h => h.includes('ai') && h.includes('columbia'));
    const wCol = header.findIndex(h => h.includes('wharton only'));
    const wcCol = header.findIndex(h => h.includes('wharton + columbia'));
    if (aiCol < 0 || wCol < 0) return null;

    const dataPulled = S(rows[0]?.[0]).replace(/^data pulled:\s*/i, '') || null;

    let comparisonNote: string | null = null;
    const advisors: ConsultAdvisorBlock[] = [];
    for (let i = hIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!S(r[0]).startsWith('1:1 Consults')) continue;
      const advisor = S(r[1]) || 'Total';
      if (!comparisonNote && S(r[2])) comparisonNote = S(r[2]);
      const metric = (row: string[] | undefined, col: number): [number | null, number | null] =>
        [N(row?.[col]), N(row?.[col + 1])];
      const completedRow = rows[i + 1];
      const enrolleesRow = rows[i + 2];
      const cvrRow = rows[i + 3];
      if (!completedRow) continue;
      advisors.push({
        advisor,
        columbia: { completed: metric(completedRow, aiCol), enrollees: metric(enrolleesRow, aiCol), cvr: metric(cvrRow, aiCol) },
        wharton: { completed: metric(completedRow, wCol), enrollees: metric(enrolleesRow, wCol), cvr: metric(cvrRow, wCol) },
        combined: wcCol >= 0
          ? { completed: metric(completedRow, wcCol), enrollees: metric(enrolleesRow, wcCol), cvr: metric(cvrRow, wcCol) }
          : { completed: [null, null], enrollees: [null, null], cvr: [null, null] },
      });
    }
    return advisors.length ? { dataPulled, comparisonNote, advisors } : null;
  } catch {
    return null;
  }
}

// ─── 3 · Tuition assistance ("Tuition Assistance Data") ───────────────────────

export interface TAData {
  dataPulled: string | null;
  comparisonNote: string | null;
  wharton: { apps: [number | null, number | null]; enrollees: [number | null, number | null]; cvr: [number | null, number | null] };
  columbia: { apps: [number | null, number | null]; enrollees: [number | null, number | null]; cvr: [number | null, number | null] };
}

async function readTA(): Promise<TAData | null> {
  try {
    const rows = await readTab('Tuition Assistance Data');
    const hIdx = rows.findIndex(r => r.some(c => S(c).toLowerCase().includes('wharton only')));
    if (hIdx < 0) return null;
    const header = rows[hIdx].map(c => S(c).toLowerCase());
    const wCol = header.findIndex(h => h.includes('wharton only'));
    const cCol = header.findIndex(h => h.includes('ai f&b') || h.includes('ai (columbia'));

    const rowFor = (needle: string) => rows.find(r => S(r[0]).toLowerCase().startsWith(needle));
    const appsRow = rowFor('ta applications');
    const enrRow = rowFor('ta enrollees');
    const cvrRow = rowFor('ta conversion');
    if (!appsRow) return null;

    const pair = (row: string[] | undefined, col: number): [number | null, number | null] =>
      col >= 0 ? [N(row?.[col]), N(row?.[col + 1])] : [null, null];

    const comparisonRow = rows.find(r => S(r[1]).toLowerCase().includes('baseline:'));
    return {
      dataPulled: S(rows[0]?.[0]).replace(/^data pulled:\s*/i, '') || null,
      comparisonNote: comparisonRow ? S(comparisonRow[1]) : null,
      wharton: { apps: pair(appsRow, wCol), enrollees: pair(enrRow, wCol), cvr: pair(cvrRow, wCol) },
      columbia: { apps: pair(appsRow, cCol), enrollees: pair(enrRow, cCol), cvr: pair(cvrRow, cCol) },
    };
  } catch {
    return null;
  }
}

// ─── 4 · Info sessions ("Info Session Data") ──────────────────────────────────

export interface InfoSessionWeek {
  session: string;      // "Session 3"
  week: string;         // "Week 9"
  date: string;         // "Apr 13 - 17"
  registrations: number | null;
  attendance: number | null;
}

export interface InfoSessionComparison {
  label: string;        // "Winter 2026 - C9"
  values: Array<number | null>;  // attendance at the same session slots
  total: number | null;
}

export interface InfoSessionsData {
  cohortLabel: string;
  weeks: InfoSessionWeek[];
  totalRegistrations: number | null;
  totalAttendance: number | null;
  comparisons: InfoSessionComparison[];
}

async function readInfoSessions(activeLabelHints: string[]): Promise<InfoSessionsData | null> {
  try {
    const rows = await readTab('Info Session Data');
    if (rows.length < 5) return null;
    const cohortRow = rows[0].map(c => S(c));

    // Cohort blocks start where row 0 has a "<Season> <Year>" label
    const blockStarts: Array<{ label: string; col: number }> = [];
    cohortRow.forEach((c, i) => {
      if (i > 0 && /20\d\d/.test(c)) blockStarts.push({ label: c, col: i });
    });
    if (!blockStarts.length) return null;

    const totalsIdx = rows.findIndex(r => S(r[0]).toUpperCase().startsWith('TOTALS'));
    if (totalsIdx < 0) return null;
    const regRowIdx = rows.findIndex((r, i) => i > totalsIdx && S(r[0]).toLowerCase().startsWith('info session registrations'));
    const attRowIdx = rows.findIndex((r, i) => i > totalsIdx && S(r[0]).toLowerCase().startsWith('info session - current'));
    if (regRowIdx < 0 || attRowIdx < 0) return null;

    const maxLen = Math.max(...rows.slice(0, 5).map(r => r.length));
    const withEnds = blockStarts.map((b, i) => ({
      ...b,
      end: i + 1 < blockStarts.length ? blockStarts[i + 1].col : maxLen,
    }));
    const blockHasData = (start: number, end: number) =>
      (rows[regRowIdx] ?? []).slice(start, end).some(c => N(c) !== null);

    // Prefer a block matching an active-cohort hint that has data; else the
    // first block with data.
    const hinted = withEnds.find(b =>
      activeLabelHints.some(h => b.label.toLowerCase().includes(h.toLowerCase())) && blockHasData(b.col, b.end)
    );
    const block = hinted ?? withEnds.find(b => blockHasData(b.col, b.end));
    if (!block) return null;

    // "Cohort Totals" column sits inside the block (labeled on the date row)
    const dateRow = rows[3] ?? [];
    let totalsCol = -1;
    for (let c = block.col; c < block.end; c++) {
      if (S(dateRow[c]).toLowerCase().includes('cohort totals')) totalsCol = c;
    }

    const weeks: InfoSessionWeek[] = [];
    for (let c = block.col; c < block.end; c++) {
      if (c === totalsCol) continue;
      const session = S(rows[1]?.[c]);
      if (!session.toLowerCase().startsWith('session')) continue;
      weeks.push({
        session,
        week: S(rows[2]?.[c]),
        date: S(dateRow[c]),
        registrations: N(rows[regRowIdx]?.[c]),
        attendance: N(rows[attRowIdx]?.[c]),
      });
    }

    // Same-slot prior-cohort comparison rows follow the attendance row
    const comparisons: InfoSessionComparison[] = [];
    for (let i = attRowIdx + 1; i < Math.min(attRowIdx + 12, rows.length); i++) {
      const label = S(rows[i]?.[0]);
      if (!/- ?C\d+/.test(label)) continue;
      const values: Array<number | null> = [];
      for (let c = block.col; c < block.end; c++) {
        if (c === totalsCol) continue;
        if (S(rows[1]?.[c]).toLowerCase().startsWith('session')) values.push(N(rows[i]?.[c]));
      }
      // Skip empty rows (e.g. the active cohort's own C-row placeholder)
      if (values.every(v => v === null)) continue;
      comparisons.push({
        label,
        values,
        total: totalsCol >= 0 ? N(rows[i]?.[totalsCol]) : null,
      });
    }

    return {
      cohortLabel: block.label,
      weeks,
      totalRegistrations: totalsCol >= 0 ? N(rows[regRowIdx]?.[totalsCol]) : null,
      totalAttendance: totalsCol >= 0 ? N(rows[attRowIdx]?.[totalsCol]) : null,
      comparisons,
    };
  } catch {
    return null;
  }
}

// ─── 5 · Advisor KPIs ("Enrollment KPIs/Goal Tracking - *") ───────────────────

export interface AdvisorKpiRow {
  advisor: string;
  enrollments: number | null;
  enrollGoal: number | null;
  taskCompletionPct: number | null;   // vs 90% goal
  emailsSent: number | null;          // vs 200 goal
  emailsClosed: number | null;        // vs 80 goal
  consultCvr: number | null;          // CTD, vs 35% goal
  kpisMet: string;                    // YES / NO / FALSE
  notes: string;
}

export interface AdvisorKpiWeek {
  week: string;
  dateRange: string;
  rows: AdvisorKpiRow[];
}

export interface AdvisorKpisData {
  tabLabel: string;      // e.g. "SP26"
  weeks: AdvisorKpiWeek[];  // chronological
}

async function readAdvisorKpis(activeLabelHints: string[]): Promise<AdvisorKpisData | null> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const meta = await sheets.spreadsheets.get({ spreadsheetId: ENROLLMENT_TEAM_SHEET_ID });
    const kpiTabs = (meta.data.sheets ?? [])
      .map(s => s.properties?.title ?? '')
      .filter(t => /enrollment kpis/i.test(t));
    if (!kpiTabs.length) return null;
    // Prefer a tab matching the active cohort (e.g. "FA26"); else the first
    // listed (Aubrey keeps the current cohort's tab leftmost).
    const tab =
      kpiTabs.find(t => activeLabelHints.some(h => t.toLowerCase().includes(h.toLowerCase()))) ?? kpiTabs[0];

    const rows = await readTab(tab, 'A1:R200');
    const weeks: AdvisorKpiWeek[] = [];
    let current: AdvisorKpiWeek | null = null;
    for (const r of rows.slice(1)) {
      const weekCell = S(r[0]);
      if (weekCell) {
        const [wk, ...rest] = weekCell.split('\n');
        current = { week: wk.trim(), dateRange: rest.join(' ').trim(), rows: [] };
        weeks.push(current);
      }
      const advisor = S(r[2]).replace(/\*+$/, '');
      // Real advisor rows have a name; skip header echoes, numeric junk, and
      // the cohort-end summary rows ("Total", "Kelin Total", ...)
      if (!current || !advisor || !/^[A-Za-z]/.test(advisor) || advisor.toLowerCase() === 'advisor' || /total$/i.test(advisor)) continue;
      current.rows.push({
        advisor,
        enrollments: N(r[3]),
        enrollGoal: N(r[1]),
        taskCompletionPct: N(r[7]),
        emailsSent: N(r[8]),
        emailsClosed: N(r[10]),
        consultCvr: N(r[12]),
        kpisMet: S(r[15]),
        notes: S(r[16]),
      });
    }
    const withData = weeks.filter(w => w.rows.some(x => x.emailsSent !== null || x.enrollments !== null));
    if (!withData.length) return null;
    const label = tab.match(/-\s*(\S+)\s*$/)?.[1] ?? tab;
    return { tabLabel: label, weeks: withData };
  } catch {
    return null;
  }
}

/** Lightweight freshness probe for Pulse: the "Data Pulled" stamp on the
 *  consult tab (Aubrey updates it each weekly pass). */
export async function getTeamDataPulledDate(): Promise<string | null> {
  try {
    const rows = await readTab('Team Consult Data', 'A1:A1');
    const s = S(rows[0]?.[0]).replace(/^data pulled:\s*/i, '');
    return s || null;
  } catch {
    return null;
  }
}

// ─── Assembled payload ────────────────────────────────────────────────────────

export interface EnrollmentTeamData {
  outreach: OutreachData | null;
  consults: ConsultsData | null;
  ta: TAData | null;
  infoSessions: InfoSessionsData | null;
  advisorKpis: AdvisorKpisData | null;
}

export async function getEnrollmentTeamData(activeLabelHints: string[]): Promise<
  | { ok: true; data: EnrollmentTeamData }
  | { ok: false; needsAccess: boolean; error: string }
> {
  // Probe access once so a 403 is reported as needsAccess instead of five
  // silently-null sections.
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    await sheets.spreadsheets.get({ spreadsheetId: ENROLLMENT_TEAM_SHEET_ID });
  } catch (err) {
    const msg = String(err);
    return { ok: false, needsAccess: /permission|PERMISSION_DENIED|403/i.test(msg), error: msg };
  }

  const [outreach, consults, ta, infoSessions, advisorKpis] = await Promise.all([
    readOutreach(),
    readConsults(),
    readTA(),
    readInfoSessions(activeLabelHints),
    readAdvisorKpis(activeLabelHints),
  ]);

  return { ok: true, data: { outreach, consults, ta, infoSessions, advisorKpis } };
}
