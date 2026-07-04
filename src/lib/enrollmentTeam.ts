// ─── Enrollment team (Aubrey) live reader ─────────────────────────────────────
//
// Reads the enrollment-team dashboard sheet (advisor outreach tab): per-advisor
// weekly email outreach by contact stage (Contact / Lead / Active-Qualified /
// Customer), Total sent and Closed, organized in cohort-cycle blocks
// ("Fall 2026" → Week 1, Week 2, ...).
//
// The sheet must be shared with the dashboard service account; until then the
// API reports needsAccess so the page can show activation instructions.

import { google } from 'googleapis';

export const ENROLLMENT_TEAM_SHEET_ID = '1me1ls1tI9rsj0_4vYWu2qpX9E5k7L8aCz-8WvX00IwU';
const OUTREACH_GID = 110101785;
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
  if (s === '' || s.startsWith('#')) return null;
  const n = parseFloat(s.replace(/[$,%]/g, '').replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

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
  cohortLabel: string;   // e.g. "Fall 2026"
  totals: AdvisorCohortTotals[];
  weeks: AdvisorWeekRow[];
}

export interface EnrollmentTeamData {
  tabTitle: string;
  blocks: OutreachBlock[];   // newest first, as laid out in the sheet
}

export async function getEnrollmentTeamData(): Promise<
  | { ok: true; data: EnrollmentTeamData }
  | { ok: false; needsAccess: boolean; error: string }
> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const meta = await sheets.spreadsheets.get({ spreadsheetId: ENROLLMENT_TEAM_SHEET_ID });
    const tab =
      meta.data.sheets?.find(s => s.properties?.sheetId === OUTREACH_GID)?.properties?.title ??
      meta.data.sheets?.[0]?.properties?.title;
    if (!tab) return { ok: false, needsAccess: false, error: 'No tabs found' };

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: ENROLLMENT_TEAM_SHEET_ID,
      range: `'${tab.replace(/'/g, "''")}'!A1:BA300`,
    });
    const rows = res.data.values ?? [];

    // Advisor header row: the row naming advisors (merged cells → value in first col of block)
    const aIdx = rows.findIndex(r =>
      r.filter(c => ADVISOR_NAMES.includes(String(c ?? '').trim().toUpperCase())).length >= 2
    );
    if (aIdx < 0) return { ok: false, needsAccess: false, error: 'Advisor header row not found' };

    const advisorCols: Array<{ name: string; col: number }> = [];
    rows[aIdx].forEach((c, i) => {
      const name = String(c ?? '').trim().toUpperCase();
      if (ADVISOR_NAMES.includes(name)) advisorCols.push({ name, col: i });
    });

    // Within each advisor block: Contact Sent +0, Lead Sent +2, A/Q Sent +4,
    // Customer Sent +6, Total +8, Closed +9 (offsets from the block start col).
    const readAdvisorCells = (r: (string | undefined)[]) =>
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
      const c0 = String(r[0] ?? '').trim();
      const weekMatch = c0.match(/^Week\s+(\d+)/i);
      if (weekMatch && current) {
        const perAdvisor: AdvisorWeekRow['perAdvisor'] = {};
        for (const a of readAdvisorCells(r)) {
          perAdvisor[a.advisor] = { sent: a.totalSent ?? 0, closed: a.closed };
        }
        current.weeks.push({
          week: parseInt(weekMatch[1]),
          dateRange: String(r[1] ?? '').trim(),
          perAdvisor,
        });
      } else if (/^(fall|spring|winter|summer)\s+20\d\d$/i.test(c0)) {
        current = { cohortLabel: c0, totals: readAdvisorCells(r), weeks: [] };
        blocks.push(current);
      }
    }

    return { ok: true, data: { tabTitle: tab, blocks } };
  } catch (err) {
    const msg = String(err);
    const needsAccess = /permission|PERMISSION_DENIED|403/i.test(msg);
    return { ok: false, needsAccess, error: msg };
  }
}
