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
  // CBS Fall '26 (academic Fall 2026 term) — "Overall Goals"!B2 of the Fall 2026
  // cohort performance doc. Still the ACTIVE cohort; kept here only as the
  // fallback for readers that can't reach that doc.
  "Fall '26": 560,
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

// ─── Per-program goals from the same goals tab ────────────────────────────────
// Below the cohort's headline goal, both docs carry a program-level breakdown —
// but NOT at the same columns. Wharton's table is
//   Program | % of Enrollments | Goal Enrollments | CVR | Goal Leads
// and CBS drops the percentage column
//   Program | Goal Enrollments | CVR | Goal Leads
// so columns are resolved by header name, never by index.
//
// The goals tab lays several planning models side by side ("Past Cohort Model",
// "3 Cohort CVR Avg. Model", ...). They agree on Goal Enrollments and differ only
// on CVR / Goal Leads, so reading the leftmost block (cols A–F) is unambiguous for
// enrollments and pins lead goals to the Past Cohort Model.

export interface ProgramGoal {
  program: string;
  goalEnrollments: number | null;
  goalLeads: number | null;
  /** Planned lead→enroll CVR, as a percent. */
  goalCvr: number | null;
}

export interface ProgramGoals {
  rows: ProgramGoal[];
  /** The sheet's own Total row, so callers can check the parts still sum to it. */
  total: number | null;
  source: string;
}

/** Per-program targets for the active cohort. Returns null on any miss (tab
 *  absent, no "Program" header, non-numeric) so callers fall back rather than
 *  render a partial breakdown. */
export async function readProgramGoals(sheetId: string, tab: string): Promise<ProgramGoals | null> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${tab}'!A1:F40`,
    });
    const rows = res.data.values ?? [];
    const hIdx = rows.findIndex(r => (r?.[0] ?? '').toString().trim().toLowerCase() === 'program');
    if (hIdx < 0) return null;

    const header = rows[hIdx].map(c => String(c ?? '').trim().toLowerCase());
    const col = (...needles: string[]) =>
      header.findIndex(h => h !== '' && needles.every(n => h.includes(n)));
    const cEnroll = col('goal', 'enrollment');
    const cLeads = col('goal', 'lead');
    const cCvr = col('cvr');
    if (cEnroll < 0) return null;

    const at = (r: string[], i: number) => (i >= 0 ? N(r[i]) : null);
    const out: ProgramGoal[] = [];
    let total: number | null = null;
    for (const r of rows.slice(hIdx + 1, hIdx + 12)) {
      const label = (r?.[0] ?? '').toString().trim();
      if (!label) break;
      if (/^\*/.test(label)) continue;
      // The Total row closes the block — capture it as the cross-check, don't
      // emit it as a program.
      if (/^total$/i.test(label)) { total = at(r, cEnroll); break; }
      out.push({
        program: label,
        goalEnrollments: at(r, cEnroll),
        goalLeads: at(r, cLeads),
        goalCvr: at(r, cCvr),
      });
    }
    if (out.length === 0) return null;
    const n = out.length;
    return { rows: out, total, source: `${tab}!A${hIdx + 1} (${n} program${n === 1 ? '' : 's'})` };
  } catch {
    return null;
  }
}

// ─── Channel attribution from "Overall Performance Tables" ───────────────────
// Every Wharton cohort doc — active and historical — opens with the same block:
//   Channel | Enrolls | % of Total | Leads | Leads per Enroll | Direct Spend |
//   ROAS | Cost Per Lead | Cost Per Enrollment | Lead:Enroll
// ending in a "Grand Total" row. Only the channels carrying direct spend have
// spend/ROAS/CPL/CPE; the rest are enrollment+lead only, and their blanks are
// read as null (unknown) rather than 0 (measured zero).
//
// ROAS is NOT comparable across rows as the sheet computes it: each cell is
// `=(enrolls * <revenue per enrollment>) / spend`, and the constant varies —
// the Ads row uses gross ARPU ($4,500) while the Grand Total uses the
// net-of-university-rev-share figure ($2,700). Rather than silently mix bases we
// pull the constant out of each formula and hand it to the UI to label. When the
// formula shape changes the multiplier simply reads back null and the row is
// shown without a basis rather than with a wrong one.

export interface ChannelRowLive {
  channel: string;
  enrolls: number | null;
  pct: number | null;      // % of total enrollments
  leads: number | null;
  spend: number | null;
  roas: number | null;
  cpl: number | null;
  cpe: number | null;
  cvr: number | null;      // Lead:Enroll, as a percent
  /** Revenue-per-enrollment this row's ROAS formula used, when detectable. */
  roasArpu: number | null;
}

export interface ChannelTable {
  rows: ChannelRowLive[];
  total: ChannelRowLive | null;
  source: string;
}

/** Pull the revenue-per-enrollment constant out of `=(B3*4500)/F3`. */
function arpuOf(formula: string | undefined): number | null {
  const m = String(formula ?? '').match(/\*\s*(\d{3,6})\s*\)/);
  return m ? Number(m[1]) : null;
}

/** Money-aware parse. The shared N() above deliberately leaves "$" alone, but
 *  this block formats spend / CPL / CPE / ROAS as currency, so those cells need
 *  the symbol stripped or every one of them reads back null. */
function NUM(v: string | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === '' || s.startsWith('#')) return null;
  const n = parseFloat(s.replace(/[$,%]/g, '').replace(/[()]/g, ''));
  return isNaN(n) ? null : n;
}

export async function readChannelTable(sheetId: string, tab = 'Overall Performance Tables'): Promise<ChannelTable | null> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const range = `'${tab}'!A1:J24`;
    const [valRes, fmlRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range }),
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range, valueRenderOption: 'FORMULA' }),
    ]);
    const rows = valRes.data.values ?? [];
    const fmls = fmlRes.data.values ?? [];

    // Several docs stack a two-row summary block ("Traditional Paid Channels" /
    // "Organic-Direct-Owned") above the real per-channel table, under an
    // identical "Channel" header. Anchor on the Grand Total and walk back to the
    // nearest header so we always land on the block that actually totals.
    const isChannelHdr = (i: number) => (rows[i]?.[0] ?? '').toString().trim().toLowerCase() === 'channel';
    const gtIdx = rows.findIndex(r => /^grand total$/i.test((r?.[0] ?? '').toString().trim()));
    let hIdx = -1;
    for (let i = gtIdx - 1; i >= 0; i--) if (isChannelHdr(i)) { hIdx = i; break; }
    if (hIdx < 0) hIdx = rows.findIndex((_, i) => isChannelHdr(i));
    if (hIdx < 0) return null;

    const header = rows[hIdx].map(c => String(c ?? '').trim().toLowerCase());
    const col = (...needles: string[]) =>
      header.findIndex(h => h !== '' && needles.every(n => h.includes(n)));
    const c = {
      enrolls: col('enroll'),
      pct: col('%'),
      leads: header.findIndex(h => h === 'leads'),
      spend: col('spend'),
      roas: col('roas'),
      cpl: col('cost per lead'),
      cpe: col('cost per enrollment'),
      cvr: col('lead:enroll'),
    };
    if (c.enrolls < 0) return null;

    const at = (r: string[], i: number) => (i >= 0 ? NUM(r[i]) : null);
    const build = (r: string[], f: string[], label: string): ChannelRowLive => ({
      channel: label,
      enrolls: at(r, c.enrolls),
      pct: at(r, c.pct),
      leads: at(r, c.leads),
      spend: at(r, c.spend),
      roas: at(r, c.roas),
      cpl: at(r, c.cpl),
      cpe: at(r, c.cpe),
      cvr: at(r, c.cvr),
      roasArpu: c.roas >= 0 ? arpuOf(f?.[c.roas]) : null,
    });

    const out: ChannelRowLive[] = [];
    let total: ChannelRowLive | null = null;
    for (let i = hIdx + 1; i < rows.length; i++) {
      const label = (rows[i]?.[0] ?? '').toString().trim();
      if (!label) break;
      // "Grand Total" closes the block. The "Excl. B2B" variant that follows is a
      // restatement of the same cohort, not another channel — stop at the first.
      if (/^grand total/i.test(label)) {
        if (!total) total = build(rows[i], fmls[i] ?? [], label);
        break;
      }
      out.push(build(rows[i], fmls[i] ?? [], label));
    }
    if (out.length === 0) return null;
    return { rows: out, total, source: `${tab}!A${hIdx + 1}` };
  } catch {
    return null;
  }
}

// ─── Paid-only performance from "Paid WoW Performance & Goals" ───────────────
// This tab is the paid-media counterpart to Overall WoW, and its figures are
// deliberately smaller: paid leads/enrollments only (5,572 / 54 for Wharton
// Fall '26) against all-source (6,888 / 116). Four blocks matter:
//
//   "Overall Performance"      cols B–T   — all-paid totals by program, plus the
//                                            CPL / CPE goals paid is held to
//   Google | Bing | Meta | LinkedIn       — the same shape per channel; their
//                                            "Total (All)" rows sum to the above
//   "Paid Total Weekly"        cols CA–CO — the all-paid weekly series
//
// Blocks are located by their banner text and columns resolved by header name,
// because the four channel blocks sit at different offsets and each has its own
// slightly different column order. Weekly rows are every sixth line (indented
// per-program sub-rows fill the gaps), so they're found by scanning for a date
// range rather than by stride.

export interface PaidWeek {
  week: number;
  dateRange: string;
  spend: number | null; spendF: number | null;
  leads: number | null; leadsF: number | null;
  enrolls: number | null; enrollsF: number | null;
  cpl: number | null; cpe: number | null; cvr: number | null;
}

export interface PaidRow {
  label: string;
  spend: number | null; spendF: number | null;
  leads: number | null; leadsF: number | null;
  enrolls: number | null; enrollsF: number | null;
  cpl: number | null; cpe: number | null;
  cplGoal: number | null; cpeGoal: number | null;
  cvr: number | null; roas: number | null;
}

export interface PaidWoW {
  /** "Total (All)" from the all-paid block. */
  totals: PaidRow | null;
  programs: PaidRow[];
  /** Per-channel "Total (All)" rows — Google / Bing / Meta / LinkedIn / … */
  channels: PaidRow[];
  weeks: PaidWeek[];
  source: string;
}

// CBS runs an "Open AI" line the Wharton doc doesn't; the list is the union.
const PAID_CHANNELS = ['Google', 'Bing', 'Meta', 'LinkedIn', 'Open AI'];

/** The block's grand-total row. Wharton labels it "Total (All)" and carries a
 *  "Total (No RDI)" restatement beside it; CBS just says "Total". Matching both
 *  while never matching the restatement keeps one reader over both layouts. */
function isGrandTotal(label: string) {
  return /^total\s*\(all\)\s*$/i.test(label) || /^total\s*$/i.test(label);
}

/** Column resolver scoped to one block, so "spend (actual)" in the Meta block
 *  can't be satisfied by the Google block's identically-named column. */
function blockCols(header: string[], base: number, end: number) {
  return (...needles: string[]) => {
    for (let i = base; i < end; i++) {
      const h = String(header[i] ?? '').trim().toLowerCase();
      if (h !== '' && needles.every(n => h.includes(n))) return i;
    }
    return -1;
  };
}

export async function readPaidWoW(sheetId: string, tab = 'Paid WoW Performance & Goals'): Promise<PaidWoW | null> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${tab}'!A1:CZ220`,
    });
    const rows = (res.data.values ?? []) as string[][];
    const cell = (r: number, c: number) => String(rows[r]?.[c] ?? '').trim();
    const at = (r: string[], i: number) => (i >= 0 ? NUM(r?.[i]) : null);

    const readRow = (r: string[], find: ReturnType<typeof blockCols>, label: string): PaidRow => ({
      label,
      spend: at(r, find('spend', 'actual')),
      spendF: at(r, find('spend', 'forecast')),
      leads: at(r, find('leads', 'actual')),
      leadsF: at(r, find('leads', 'forecast')),
      enrolls: at(r, find('enrollments', 'actual')),
      enrollsF: at(r, find('enrollment', 'forecast')),
      cpl: at(r, find('cpl', 'actual')),
      cpe: at(r, find('cpe', 'actual')),
      cplGoal: at(r, find('cpl', 'goal')),
      cpeGoal: at(r, find('cpe', 'goal')),
      cvr: at(r, find('cvr', 'actual')),
      roas: at(r, find('roas', 'actual')),
    });

    // ── Per-channel blocks: banner row carrying the channel names ──
    const banner = rows.findIndex(r =>
      PAID_CHANNELS.filter(ch => (r ?? []).some(c => String(c ?? '').trim() === ch)).length >= 2);

    // ── All-paid block: the first header row whose column B reads "Program" ──
    // Wharton opens with a combined-paid block and puts the channels below it.
    // CBS has no combined block at all, so its first "Program" header in column B
    // belongs to the Google channel — reading it as all-paid would label one
    // channel's numbers as the cohort's paid total. The banner directly above the
    // header is what tells the two layouts apart.
    let pHdr = rows.findIndex(r => String(r?.[1] ?? '').trim().toLowerCase() === 'program');
    if (pHdr >= 0 && banner >= 0 && pHdr - 1 === banner) pHdr = -1;

    let totals: PaidRow | null = null;
    const programs: PaidRow[] = [];
    if (pHdr >= 0) {
      const pFind = blockCols(rows[pHdr], 1, 21);
      for (let i = pHdr + 1; i < pHdr + 12 && i < rows.length; i++) {
        const label = cell(i, 1);
        if (!label) break;
        if (isGrandTotal(label)) { totals = readRow(rows[i], pFind, 'Total'); continue; }
        // "Total (No RDI)" is a restatement of the same paid spend, not a program.
        if (/^total/i.test(label) || /^\*/.test(label)) continue;
        programs.push(readRow(rows[i], pFind, label));
      }
    }

    const channels: PaidRow[] = [];
    if (banner >= 0) {
      const spots = PAID_CHANNELS
        .map(ch => ({ ch, col: rows[banner].findIndex(c => String(c ?? '').trim() === ch) }))
        .filter(s => s.col >= 0)
        .sort((a, b) => a.col - b.col);
      spots.forEach((s, k) => {
        const end = k + 1 < spots.length ? spots[k + 1].col : s.col + 21;
        const hdr = banner + 1;
        const find = blockCols(rows[hdr] ?? [], s.col, end);
        // The block's own "Total (All)" — found by scanning its column, so an
        // extra row inserted above it doesn't shift us onto a program row.
        for (let i = hdr + 1; i < hdr + 12 && i < rows.length; i++) {
          if (isGrandTotal(cell(i, s.col))) {
            channels.push({ ...readRow(rows[i], find, s.ch) });
            break;
          }
        }
      });
    }

    // ── "Paid Total Weekly": all-paid weekly series ──
    const weeks: PaidWeek[] = [];
    let wCol = -1, wHdr = -1;
    for (let r = 0; r < rows.length && wCol < 0; r++) {
      const k = (rows[r] ?? []).findIndex(c => /paid total weekly/i.test(String(c ?? '')));
      if (k >= 0) { wCol = k; wHdr = r + 1; }
    }
    if (wCol >= 0) {
      const find = blockCols(rows[wHdr] ?? [], wCol, wCol + 20);
      const c = {
        spend: find('spend', 'actual'), spendF: find('spend', 'forecast'),
        leads: find('leads', 'actual'), leadsF: find('leads', 'forecast'),
        enrolls: find('enrollments', 'actual'), enrollsF: find('enrollment', 'forecast'),
        cpl: find('cpl', 'actual'), cpe: find('cpe', 'actual'), cvr: find('cvr', 'actual'),
      };
      for (let r = wHdr + 1; r < rows.length; r++) {
        const range = cell(r, wCol);
        if (!/\d+\/\d+\s*-\s*\d+\/\d+/.test(range)) continue;
        const row = rows[r];
        weeks.push({
          week: weeks.length + 1,   // no week-number column in this block; the
          dateRange: range,         // rows run in order from the cohort's open
          spend: at(row, c.spend), spendF: at(row, c.spendF),
          leads: at(row, c.leads), leadsF: at(row, c.leadsF),
          enrolls: at(row, c.enrolls), enrollsF: at(row, c.enrollsF),
          cpl: at(row, c.cpl), cpe: at(row, c.cpe), cvr: at(row, c.cvr),
        });
      }
    }

    // Deliberately NOT synthesising a combined total by summing channels when the
    // doc lacks one. CBS's Open AI line currently reports 57,339 enrollments
    // against $0 spend and 0 leads, and rolling that into a headline would
    // quietly corrupt every figure derived from it. Channels are shown as the
    // sheet states them so a bad row stays visibly attributable to its channel.
    if (!totals && channels.length === 0 && weeks.length === 0) return null;
    return { totals, programs, channels, weeks, source: tab };
  } catch {
    return null;
  }
}

// ─── Closed-cohort finals from the Summary Cohort Tracker ────────────────────
// "Professional Certificates Channel Performance" carries one tab per cohort
// back to Spring 2023 for both schools, each using the SAME block shape as a
// live cohort doc's "Overall Performance Tables" — so the same column-by-name
// parse works over both, including the three oldest tabs which carry an extra
// "Pre Affiliate Adj" column that shifts everything one to the right.
//
// This is the source for closed-cohort economics rather than the cohorts' own
// docs: those degrade after close (Winter '26's own doc reports 5,578 leads and
// a 1927% email CVR against the tracker's 19,487 and 63.6%, while agreeing on
// spend to the cent).
//
// IMPORTANT: these are cohort FINALS. The comparison panel elsewhere reports
// closed cohorts at the same day-out, which is a different question and a much
// smaller number — the two must not share a row.

export const COHORT_TRACKER_DOC_ID =
  process.env.COHORT_TRACKER_DOC_ID ?? '16Me7guESIVYQsIUsVk2y9bWYYtMu9RbBm8X-dWtpZFk';

export interface CohortFinals {
  /** The dashboard's label for the cohort, e.g. "Wharton Winter '26". */
  label: string;
  /** Tracker tab the numbers came from, for provenance in the UI. */
  tab: string;
  enrolls: number | null;
  leads: number | null;
  spend: number | null;
  roas: number | null;
  cpl: number | null;
  cpe: number | null;
  cvr: number | null;
  /** Revenue per enrollment the tab's ROAS formula used ($4,500 for the older
   *  cohorts, $4,660 from Fall '25 on) — a price change, not an error. */
  roasArpu: number | null;
}

/** Columbia's marketing label runs one term ahead of the tracker's academic
 *  name for the same cohort (the "Summer '26" cycle is the tracker's
 *  "CBS Spring 2026"). Only genuine divergences belong here. */
const TRACKER_TAB_ALIASES: Record<string, string> = {
  "cbsee summer '26": 'CBS Spring 2026 Cohort',
};

/** Candidate tracker tab names for a dashboard cohort label. Wharton's older
 *  cohorts predate the school prefix, so the unprefixed form is tried too. */
function trackerTabCandidates(label: string, family: 'wharton' | 'columbia'): string[] {
  const alias = TRACKER_TAB_ALIASES[label.trim().toLowerCase()];
  if (alias) return [alias];
  const m = label.match(/(winter|spring|summer|fall)\s*'?(\d{2,4})/i);
  if (!m) return [];
  const season = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  const year = m[2].length === 4 ? m[2] : `20${m[2]}`;
  return family === 'columbia'
    ? [`CBS ${season} ${year} Cohort`]
    : [`Wharton ${season} ${year} Cohort`, `${season} ${year} Cohort`];
}

/** Finals for the given cohort labels. Labels with no matching tab are omitted
 *  rather than guessed at, so the UI shows a gap instead of a wrong cohort. */
export async function readCohortFinals(
  labels: string[],
  family: 'wharton' | 'columbia',
  sheetId = COHORT_TRACKER_DOC_ID,
): Promise<CohortFinals[]> {
  try {
    if (labels.length === 0) return [];
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: 'sheets.properties.title' });
    const tabs = (meta.data.sheets ?? []).map(s => s.properties?.title ?? '');
    const lower = new Map(tabs.map(t => [t.toLowerCase(), t]));

    const wanted = labels
      .map(label => {
        const tab = trackerTabCandidates(label, family)
          .map(c => lower.get(c.toLowerCase()))
          .find(Boolean);
        return tab ? { label, tab } : null;
      })
      .filter((x): x is { label: string; tab: string } => x !== null);
    if (wanted.length === 0) return [];

    const ranges = wanted.map(w => `'${w.tab}'!A1:K26`);
    const [vals, fmls] = await Promise.all([
      sheets.spreadsheets.values.batchGet({ spreadsheetId: sheetId, ranges }),
      sheets.spreadsheets.values.batchGet({ spreadsheetId: sheetId, ranges, valueRenderOption: 'FORMULA' }),
    ]);

    const out: CohortFinals[] = [];
    wanted.forEach((w, i) => {
      const rows = (vals.data.valueRanges?.[i]?.values ?? []) as string[][];
      const fRows = (fmls.data.valueRanges?.[i]?.values ?? []) as string[][];
      const gtIdx = rows.findIndex(r => /^grand total$/i.test((r?.[0] ?? '').toString().trim()));
      if (gtIdx < 0) return;
      let hIdx = -1;
      for (let j = gtIdx - 1; j >= 0; j--) {
        if ((rows[j]?.[0] ?? '').toString().trim().toLowerCase() === 'channel') { hIdx = j; break; }
      }
      if (hIdx < 0) return;

      const header = rows[hIdx].map(c => String(c ?? '').trim().toLowerCase());
      const col = (...needles: string[]) =>
        header.findIndex(h => h !== '' && needles.every(n => h.includes(n)));
      const gt = rows[gtIdx];
      const at = (idx: number) => (idx >= 0 ? NUM(gt[idx]) : null);
      const roasCol = col('roas');
      out.push({
        label: w.label,
        tab: w.tab,
        // "Enrolls" precedes "Leads per Enroll" in every layout, so the first
        // header containing "enroll" is the count, not the ratio.
        enrolls: at(col('enroll')),
        leads: at(header.findIndex(h => h === 'leads')),
        spend: at(col('spend')),
        roas: at(roasCol),
        cpl: at(col('cost per lead')),
        cpe: at(col('cost per enrollment')),
        cvr: at(col('lead:enroll')),
        roasArpu: roasCol >= 0 ? arpuOf(fRows[gtIdx]?.[roasCol]) : null,
      });
    });
    return out;
  } catch {
    return [];
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
  // Last day with a genuinely keyed actual, YYYY-MM-DD. `enrolled` and `forecast`
  // are both read at this day, which is normally YESTERDAY — the tab pre-fills a
  // 0 into today's row until someone enters it. Surfaced so a date control can
  // default to the last COMPLETE day instead of to a today that has no data.
  dataThrough?: string;
}

export interface PacingDataPoint {
  day: number;
  // Dynamic historical % lines — ordered oldest→newest (matches column order in sheet).
  // Labels are read from the sheet header row so they self-update when cohorts rotate.
  // pct = % of that cohort's OWN eventual final total (pacing shape, not target progress) —
  // raw is the actual enrollment count that pct was derived from. "Goal Pace" entries
  // (V2 reader) aren't a real cohort and carry no raw.
  // `final` is that cohort's own eventual total (the day-0 value) — the denominator
  // pct was computed against. Carried through so the comparison table can show what
  // each closed cohort actually finished at next to what it was aiming for.
  wHistoricals: Array<{ label: string; pct: number; raw?: number; final?: number }>;
  cHistoricals: Array<{ label: string; pct: number; raw?: number; final?: number }>;
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
  // What this cohort actually finished at. Null while a cohort is still enrolling —
  // `enrolled` is its count so far, and its final total isn't knowable yet.
  finalTotal: number | null;
  isActive: boolean;
}

export interface ComparisonPanel {
  program: string;
  daysRemaining: number;
  activeRow: ComparisonRow;
  last3Avg: { enrolled: number; goal: number; pctOfGoal: number; pctComplete: number | null; finalTotal: number | null };
  closedRows: ComparisonRow[];
  /** What `closedRows[].enrolled` represents: each cohort's enrollment at the same
   *  days-out as the active cohort ('same-day-out' — the pace comparison), or its
   *  final total ('finals'). These differ by an order of magnitude early in a
   *  cycle, so any UI showing these rows must say which it is. */
  basis: 'same-day-out' | 'finals';
}

// ─── "Overall Cohort - AN Summary" column resolution ──────────────────────────
//
// This table used to be read through hardcoded 0-based indices. That is exactly
// backwards: the sheet's owner inserts a column on every cohort rotation, so the
// POSITIONS shift while the HEADERS stay semantically stable. A shifted index
// doesn't throw — it silently returns the adjacent cohort's smooth cumulative
// curve, which is type-correct, unit-correct, and wrong. (It did: as of Aug 2026
// every index below was one column short, so "active Wharton" was reading closed
// Winter '26 and "active CBSEE" was reading closed Winter '26.)
//
// So: resolve everything from the header text, every read, and throw when the
// shape isn't what we expect rather than defaulting to a plausible number.
//
// Layout, for reference (row indices are found, never assumed):
//   banner row  … "Wharton Cohort # Enrollment Distribution" … "CBSEE Cohort # …"
//   "Days" row  … "Wharton Spring '24" … "Wharton Fall '26 - actual" | "… - forecast"
// The "%" blocks carry the same cohort names, so the banner match keys on the "#".

const COL_DAY = 0;
const ACTUAL_RE = /\s*-\s*actual\s*$/i;
const FORECAST_RE = /\s*-\s*forecast\s*$/i;

/** "Wharton Fall '26 - actual" → "Wharton Fall '26" */
function stripSeriesSuffix(s: string): string {
  return s.replace(ACTUAL_RE, '').replace(FORECAST_RE, '').trim();
}

export interface CohortBlock {
  /** Closed cohorts, oldest → newest (everything left of the active column). */
  hist: Array<{ col: number; label: string }>;
  /** The in-progress cohort's running-actual column. */
  activeCol: number | null;
  activeLabel: string | null;
  /** The active cohort's forecast / goal-pace column, when the sheet has one. */
  forecastCol: number | null;
}

/** Columns of one program's "# Enrollment Distribution" block.
 *  `pin` selects a specific cohort as the active one (by normalized label, e.g.
 *  "Spring '26") so a closed-cohort view can be rendered from the same table;
 *  without it the newest "- actual" column wins. */
function resolveBlock(
  headerRow: string[],
  start: number,
  end: number,
  pin?: string,
): CohortBlock {
  const cols: Array<{ col: number; label: string }> = [];
  for (let c = start; c < end; c++) {
    const label = String(headerRow[c] ?? '').trim();
    if (label) cols.push({ col: c, label });
  }

  const active = pin
    ? cols.find(c => normLabel(stripSeriesSuffix(c.label)) === pin && !FORECAST_RE.test(c.label)) ?? null
    : [...cols].reverse().find(c => ACTUAL_RE.test(c.label)) ?? null;

  if (!active) return { hist: cols.map(c => ({ col: c.col, label: stripSeriesSuffix(c.label) })), activeCol: null, activeLabel: null, forecastCol: null };

  // The forecast column is the active cohort's own — matched by label, not by
  // "the next column over", so a rotation can't repoint it at another cohort.
  const activeName = stripSeriesSuffix(active.label);
  const forecast = cols.find(c => c.col > active.col && FORECAST_RE.test(c.label) && stripSeriesSuffix(c.label) === activeName) ?? null;

  return {
    // Anything to the RIGHT of the active column belongs to a later cohort, not
    // to history — dropping it is what makes `pin` render a closed cohort cleanly.
    hist: cols.filter(c => c.col < active.col).map(c => ({ col: c.col, label: stripSeriesSuffix(c.label) })),
    activeCol: active.col,
    activeLabel: activeName,
    forecastCol: forecast?.col ?? null,
  };
}

/** Both program blocks of the AN Summary table, resolved from the banner row. */
function resolveSummaryBlocks(
  rows: string[][],
  headerIdx: number,
  pins: { wharton?: string; cbsee?: string } = {},
): { wharton: CohortBlock; cbsee: CohortBlock | null } {
  const headerRow = (rows[headerIdx] ?? []).map(c => String(c ?? ''));

  let banners: Array<{ col: number; text: string }> = [];
  for (let i = headerIdx - 1; i >= Math.max(0, headerIdx - 6); i--) {
    const hits = (rows[i] ?? [])
      .map((c, col) => ({ col, text: String(c ?? '') }))
      .filter(x => /#\s*enrollment/i.test(x.text));
    if (hits.length) { banners = hits; break; }
  }
  const wBanner = banners.find(b => /wharton/i.test(b.text));
  if (!wBanner) {
    throw new Error(
      'AN Summary: no "Wharton Cohort # Enrollment Distribution" banner found above the "Days" header — ' +
      'the sheet layout changed. Refusing to guess column positions.'
    );
  }
  const cBanner = banners.find(b => /cbsee|columbia|cbs/i.test(b.text));

  const starts = banners.map(b => b.col).sort((a, b) => a - b);
  const endOf = (start: number) => starts.find(c => c > start) ?? headerRow.length;

  const wharton = resolveBlock(headerRow, wBanner.col, endOf(wBanner.col), pins.wharton);
  if (wharton.activeCol === null) {
    throw new Error('AN Summary: Wharton block has no "- actual" column' + (pins.wharton ? ` matching "${pins.wharton}"` : ''));
  }
  const cbsee = cBanner ? resolveBlock(headerRow, cBanner.col, endOf(cBanner.col), pins.cbsee) : null;

  return { wharton, cbsee: cbsee?.activeCol !== null ? cbsee : null };
}

export async function getPacingData(sheetId?: string, opts: {
  /** Render a closed cohort instead of the newest one (normalized labels,
   *  e.g. `{ wharton: "Spring '26", cbsee: "Summer '26" }`). */
  pins?: { wharton?: string; cbsee?: string };
  /** Rewind to an earlier day. This table has no dates — its rows ARE the
   *  days-remaining index — so the cutoff is expressed in days-out (see
   *  daysOutAt in cohortCalendar). Rows below the cutoff are in the future
   *  relative to the requested day and are treated as unkeyed. */
  asOfDay?: { wharton?: number; cbsee?: number };
} = {}): Promise<{
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

  // --- Resolve each program's columns from the header text (never by position) ---
  const blocks = resolveSummaryBlocks(rows, headerIdx, opts.pins);
  const wBlock = blocks.wharton;
  const cBlock = blocks.cbsee;
  const HIST_W_COLS = wBlock.hist.map(h => h.col);
  const HIST_C_COLS = cBlock?.hist.map(h => h.col) ?? [];
  const wHistLabels = wBlock.hist.map(h => h.label);
  const cHistLabels = cBlock?.hist.map(h => h.label) ?? [];

  // Each historical column's own eventual final total — used as the denominator for
  // "% complete" (pacing), independent of whatever W_GOALS/C_GOALS record as the target.
  // Read from the day=0 row by lookup, not dataRows[0]: a spacer row under the header
  // would make that a mid-cohort snapshot and push every % complete over 100.
  const zeroRow = dataRows.find(r => Number(r[COL_DAY]) === 0);
  if (!zeroRow) throw new Error(`"${tab}": no day-0 row found — cannot compute % complete`);
  const wOwnFinals = HIST_W_COLS.map(col => N(zeroRow[col]));
  const cOwnFinals = HIST_C_COLS.map(col => N(zeroRow[col]));

  // --- Find first row with data for each program (rows are day-0-first, so first hit = most recent) ---
  // `minDay` rewinds the view: a row with a SMALLER days-remaining than the cutoff
  // is a later calendar date than the requested one, so it hasn't happened yet
  // from that vantage point.
  const firstWithData = (col: number | null, minDay?: number) => {
    if (col === null) return -1;
    for (let i = 0; i < dataRows.length; i++) {
      if (minDay !== undefined && (N(dataRows[i]?.[COL_DAY]) ?? -1) < minDay) continue;
      if (N(dataRows[i]?.[col]) !== null) return i;
    }
    return -1;
  };
  const wIdx = firstWithData(wBlock.activeCol, opts.asOfDay?.wharton);
  const cIdx = firstWithData(cBlock?.activeCol ?? null, opts.asOfDay?.cbsee);

  const wCohortName = wBlock.activeLabel!;
  const cCohortName = cBlock?.activeLabel ?? '';

  const hasCBSEE = !!cBlock && cIdx >= 0;
  const programs = hasCBSEE ? ['wharton', 'cbsee'] : ['wharton'];

  // --- Goals for active cohorts ---
  // Prefer the W_GOALS/C_GOALS lookup (keyed by cohort name from header) so goals
  // stay correct even when the forecast column is empty or carries a different cohort.
  const wFcCol = wBlock.forecastCol;
  const cFcCol = cBlock?.forecastCol ?? null;
  const wGoal = getWGoal(wCohortName) ?? (wFcCol !== null ? N(zeroRow[wFcCol]) : null) ?? 1225;
  const cGoal = hasCBSEE ? (getCGoal(cCohortName) ?? (cFcCol !== null ? N(zeroRow[cFcCol]) : null) ?? 485) : 485;

  const wRow = wIdx >= 0 ? dataRows[wIdx] : null;
  const cRow = cIdx >= 0 ? dataRows[cIdx] : null;

  const wDays     = N(wRow?.[COL_DAY]) ?? 0;
  const wEnrolled = N(wRow?.[wBlock.activeCol!]) ?? 0;
  const wFc       = wFcCol !== null ? (N(wRow?.[wFcCol]) ?? 0) : 0;

  const cDays     = N(cRow?.[COL_DAY]) ?? 0;
  const cEnrolled = cBlock?.activeCol != null ? (N(cRow?.[cBlock.activeCol]) ?? 0) : 0;
  const cFc       = cFcCol !== null ? (N(cRow?.[cFcCol]) ?? 0) : 0;

  // histAvg: average raw enrollment of last 3 historical cohorts at current days remaining
  const avgAtRow = (row: string[] | null, cols: number[]) => {
    const last3 = cols.slice(-3);
    if (last3.length === 0) return 0;
    const vals = last3.map(col => N(row?.[col]) ?? 0);
    return Math.round(vals.reduce((s, v) => s + v, 0) / last3.length);
  };
  const wHistAvg = avgAtRow(wRow, HIST_W_COLS);
  const cHistAvg = hasCBSEE ? avgAtRow(cRow, HIST_C_COLS) : 0;

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
      // Same rule as Wharton above: a completed CBSEE cohort has no remaining
      // goal-pace row, so compare its final against the goal itself rather than
      // against a missing-column zero (which rendered "+535 vs. 0").
      forecast: cFc > 0 ? cFc : (cDays === 0 ? cGoal : 0),
      daysRemaining: cDays,
      histAvg: cHistAvg,
      keyTakeaway: cDays === 0
        ? `${cCohortName} enrolled a final ${cEnrolled.toLocaleString()} of ${cGoal.toLocaleString()} students (${cPct}%)${cEnrolled >= cGoal ? `, exceeding goal by ${(cEnrolled - cGoal).toLocaleString()}` : `, finishing ${(cGoal - cEnrolled).toLocaleString()} short of goal`}. Last 3-cohort final avg: ${cHistAvg.toLocaleString()} (${cEnrolled > cHistAvg ? '+' : ''}${(cEnrolled - cHistAvg).toLocaleString()} vs avg).`
        : `${cCohortName} has enrolled ${cEnrolled.toLocaleString()} of ${cGoal.toLocaleString()} students (${cPct}%) with ${cDays} days remaining, ${cEnrolled < cFc ? `falling ${cFc - cEnrolled} short of forecast` : `running ${cEnrolled - cFc} ahead of forecast`} and ${cEnrolled > cHistAvg ? `+${cEnrolled - cHistAvg}` : `${cEnrolled - cHistAvg}`} vs. the last 3-cohort average of ${cHistAvg.toLocaleString()}.`,
    }] : []),
  ];

  // --- Build pacing series ---
  const pacing: PacingDataPoint[] = dataRows
    .filter(r => r[COL_DAY] !== undefined && r[COL_DAY] !== '')
    .map(r => {
      const pt: PacingDataPoint = {
        day: N(r[COL_DAY]) ?? 0,
        wHistoricals: HIST_W_COLS.map((col, i) => {
          const label = wHistLabels[i];
          if (!label) return null;
          const v = N(r[col]);
          if (v === null) return null;
          const ownFinal = wOwnFinals[i];
          if (!ownFinal) return null;
          return { label, pct: +(v / ownFinal * 100).toFixed(2), raw: v, final: ownFinal };
        }).filter((x): x is { label: string; pct: number; raw: number; final: number } => x !== null),
        cHistoricals: hasCBSEE ? HIST_C_COLS.map((col, i) => {
          const label = cHistLabels[i];
          if (!label) return null;
          const v = N(r[col]);
          if (v === null) return null;
          const ownFinal = cOwnFinals[i];
          if (!ownFinal) return null;
          return { label, pct: +(v / ownFinal * 100).toFixed(2), raw: v, final: ownFinal };
        }).filter((x): x is { label: string; pct: number; raw: number; final: number } => x !== null) : [],
      };

      // Active cohort fields. Past the as-of cutoff the cohort's own line stops —
      // historical cohorts are already closed, so their full curves still show.
      const wPast = opts.asOfDay?.wharton === undefined || pt.day >= opts.asOfDay.wharton;
      const cPast = opts.asOfDay?.cbsee === undefined || pt.day >= opts.asOfDay.cbsee;
      const wa = wPast ? N(r[wBlock.activeCol!]) : null;
      if (wa !== null && wGoal > 0) {
        pt.wActualPct = +(wa / wGoal * 100).toFixed(2);
        pt.wActual = wa;
      }
      if (wFcCol !== null) {
        const wf = N(r[wFcCol]);
        if (wf !== null) pt.wForecast = wf;
      }

      if (hasCBSEE) {
        const ca = cPast ? N(r[cBlock!.activeCol!]) : null;
        if (ca !== null && cGoal > 0) {
          pt.cActualPct = +(ca / cGoal * 100).toFixed(2);
          pt.cActual = ca;
        }
        if (cFcCol !== null) {
          const cf = N(r[cFcCol]);
          if (cf !== null) pt.cForecast = cf;
        }
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
    historicals: Array<{ label: string; pct: number; raw?: number; final?: number }>,
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
        // Rounded once from the raw ratio. Re-rounding the already-2dp `pct`
        // double-rounds (4/468 = 0.8547 -> 0.85 -> 0.8, when it should read 0.9).
        pctComplete: h.final ? +(raw / h.final * 100).toFixed(1) : +h.pct.toFixed(1),
        finalTotal: h.final ?? null,
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
        finalTotal: daysRem === 0 ? enrolled : null,
        isActive: true,
      },
      last3Avg: {
        enrolled: Math.round(avg(r => r.enrolled)),
        goal: Math.round(avg(r => r.goal)),
        pctOfGoal: +avg(r => r.pctOfGoal).toFixed(1),
        pctComplete: +avg(r => r.pctComplete ?? 0).toFixed(1),
        finalTotal: Math.round(avg(r => r.finalTotal ?? 0)) || null,
      },
      closedRows: [...rows].reverse(),
      // Rows are read at the active cohort's days-out point; when that point is
      // the deadline itself (a completed cohort), they ARE the finals.
      basis: daysRem === 0 ? 'finals' : 'same-day-out',
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

// ─── Deadline pacing table reader (both cohort docs) ─────────────────────────
//
// Wharton's "Deadline Pacing Table V2" and CBS's "Deadline Pacing Table" share a
// header row but NOT column positions: the cumulative running total is col 21
// ("Total Enrollments") for Wharton, col 7 ("AI 2025 Total Enrollment") for CBS,
// because Wharton repeats the block once per program and CBS has a single one.
// Every column is therefore resolved by header text. The rule that picks the
// cumulative column is "last header containing 'Total Enrollment' that isn't a
// daily column" — which lands on the all-program total for Wharton (col 21 sits
// right of the per-program "PE Total Enrollment" …) and on the only one for CBS.

export interface TodayCard {
  cohortLabel: string;
  todayGoal: number;
  yesterdayGoal: number;
  yesterdayActual: number | null;
  /** Cumulative enrollments as of the last keyed day. */
  cohortToDate: number | null;
  updatedThrough: string | null;
  /** The same day as YYYY-MM-DD, so a date control can default to the last day
   *  with complete data rather than to today. */
  updatedThroughYmd: string | null;
  /** Days to the enrollment deadline as of today (ET), from today's row. */
  daysRemaining: number | null;
  /** Cumulative goal the plan expected by the last keyed day. */
  goalToDate: number | null;
  /** Cumulative goal at the day BEFORE the rendered day. This is the baseline the
   *  "vs pace" delta uses, matching getPacingDataV2's long-standing convention:
   *  enrollment counts reflect prior-day totals, so the fair comparison is what
   *  the plan expected by the end of that prior day. Kept as its own field so
   *  Wharton and Columbia can't drift onto two different definitions. */
  goalYesterday: number | null;
}

function dayMsOf(raw: string | undefined): number | null {
  if (!raw) return null;
  const ms = new Date(raw).setHours(0, 0, 0, 0);
  return isNaN(ms) ? null : ms;
}

export async function readDeadlineTable(
  sheetId: string,
  tab: string,
  cohortLabel: string,
  /** Render the table as of this day instead of today (see resolveAsOf). */
  asOf: Date = nowET(),
): Promise<TodayCard | null> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${tab}'!A1:AF250`,
    });
    const rows = (res.data.values ?? []) as string[][];
    const hIdx = rows.findIndex(r => (r[0] ?? '').toString().trim() === 'Current Date');
    if (hIdx < 0) return null;

    const header = rows[hIdx].map(c => String(c ?? '').trim().toLowerCase());
    const findLast = (pred: (h: string) => boolean) => {
      for (let i = header.length - 1; i >= 0; i--) if (header[i] && pred(header[i])) return i;
      return -1;
    };
    const findFirst = (pred: (h: string) => boolean) => header.findIndex(h => h && pred(h));

    const cDay        = findFirst(h => h.includes('day before deadline'));
    const cDailyGoal  = findFirst(h => h === 'daily goals');
    const cDailyReal  = findFirst(h => h.includes('daily enrollments actuals'));
    const cCumulative = findLast(h => /total enrollments?$/.test(h) && !h.includes('daily'));
    // Wharton repeats "Forecasted Goal" once per program (col 8 is PE's), and carries
    // the all-program plan in "Forecast Enrollments" — so that name is tried first.
    // CBS has a single program and only the "Forecasted Goal" column.
    const cCumGoalFc  = findFirst(h => h === 'forecast enrollments');
    const cCumGoal    = cCumGoalFc >= 0 ? cCumGoalFc : findFirst(h => h === 'forecasted goal');
    if (cDailyGoal < 0 || cDailyReal < 0) return null;

    const dataRows = rows.slice(hIdx + 1).filter(r => dayMsOf(r[0]) !== null);

    // Business day boundary is midnight ET, not server-local (UTC on Vercel)
    const todayMs = new Date(asOf).setHours(0, 0, 0, 0);
    const yesterdayMs = todayMs - 86400000;
    const rowAt = (ms: number) => dataRows.find(r => dayMsOf(r[0]) === ms) ?? null;

    const todayRow = rowAt(todayMs);
    const yRow = rowAt(yesterdayMs);

    // "Updated through" = the most recent past day that has a GENUINELY keyed
    // daily actual. The tab pre-fills 0 into rows that haven't been keyed yet —
    // Aug 13, 14 and 15 all read 0 on Aug 13 — so a plain non-null test counted
    // today as keyed and reported "keyed through Aug 13" when the last real
    // figure was Aug 12's. A positive actual is the only reliable signal the
    // day has been entered.
    //
    // A day with a true zero is therefore attributed to the prior day. That is
    // the safe direction: the cumulative column doesn't move on a zero day, so
    // cohortToDate is identical either way and only the label is a day earlier.
    // Claiming a day is complete when it isn't is the error that matters, since
    // this figure drives which day the prior-cohort comparison aligns to.
    let updatedThrough: string | null = null;
    let updatedMs = -Infinity;
    let updatedYmd: string | null = null;
    let cohortToDate: number | null = null;
    let goalToDate: number | null = null;
    for (const r of dataRows) {
      const ms = dayMsOf(r[0])!;
      if (ms > todayMs) continue;
      const daily = N(r[cDailyReal]);
      if (daily !== null && daily > 0 && ms > updatedMs) {
        updatedMs = ms;
        const d = new Date(ms);
        updatedThrough = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        updatedYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (cCumulative >= 0) {
          const cumulative = N(r[cCumulative]);
          if (cumulative !== null) cohortToDate = cumulative;
        }
        if (cCumGoal >= 0) goalToDate = N(r[cCumGoal]);
      }
    }

    return {
      cohortLabel,
      todayGoal: N(todayRow?.[cDailyGoal]) ?? 0,
      yesterdayGoal: N(yRow?.[cDailyGoal]) ?? 0,
      yesterdayActual: N(yRow?.[cDailyReal]),
      cohortToDate,
      updatedThrough,
      updatedThroughYmd: updatedYmd,
      daysRemaining: cDay >= 0 ? N(todayRow?.[cDay]) : null,
      goalToDate,
      goalYesterday: cCumGoal >= 0 ? N(yRow?.[cCumGoal]) : null,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetches historical Wharton cohort pacing from the V1 sheet (Overall Cohort - AN Summary)
// and returns a Map<daysRemaining → [{label, pct}]>. Used by the V2 reader to populate
// AllCohorts historical comparison lines without adding those columns to the V2 sheet.
// ---------------------------------------------------------------------------
async function fetchHistoricalWhartonMap(
  sheetId: string
): Promise<Map<number, Array<{ label: string; pct: number; raw: number; final: number }>>> {
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

    // Every closed Wharton cohort in the sheet — resolved by header text, so the
    // "last 3 cohorts" set rolls forward on its own when a cohort closes and the
    // sheet owner adds a column. (This used to be a hardcoded index list that had
    // to be hand-edited on every rotation, and was one column stale.)
    const { hist } = resolveSummaryBlocks(rows, hIdx).wharton;
    const histCols = hist.map(h => h.col);
    const labels = hist.map(h => h.label);

    const dataRows = rows.slice(hIdx + 1);
    // pct is computed against each column's OWN eventual final (the day=0 row), not
    // W_GOALS — a cohort's recorded "goal" is often backfilled to equal its actual final
    // (see W_GOALS comment above), which would silently turn "% complete" into "% of goal"
    // for those columns. Reading the raw final straight from the sheet avoids that.
    const zeroRow = dataRows.find(r => Number(r[0]) === 0);
    const ownFinals = histCols.map(col => (zeroRow ? N(zeroRow[col]) : null));

    const map = new Map<number, Array<{ label: string; pct: number; raw: number; final: number }>>();
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
          return { label, pct: +(v / ownFinal * 100).toFixed(2), raw: v, final: ownFinal };
        })
        .filter((x): x is { label: string; pct: number; raw: number; final: number } => x !== null);
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

/** "M/D/YYYY" from the sheet → "YYYY-MM-DD" for a date input. */
function ymdOf(raw: string): string | undefined {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return undefined;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Column indices (0-based) in each data row of the V2 table
const V2 = {
  date:             0,  // "Current Date" — "M/D/YYYY"
  daysBeforeDeadline: 1, // "Day before Deadline"
  dailyActual:      4,  // "Total Daily Enrollments Actuals" (0 = pre-filled, not keyed)
  totalEnrollments: 21, // "Total Enrollments" (running cumulative actual)
  forecastEnrollments: 22, // "Forecast Enrollments"
  // Cumulative goal curve. This USED to point at col 28 — the "Daily Goals"
  // column of the secondary block repeated at the far right for charting. That
  // block was never rescaled when Fall '26's target moved 1,225 → 1,100: it
  // still tops out at 1,225 (with Plus/Minus 10% at 1,347.5/1,102.5), while the
  // operative per-day plan (col D) and its cumulative (col 22) were both rebuilt
  // on the new target — col D sums to 1,098, col 22 tops out at 1,103.
  // Reading the stale block made goalPlanTotal report 1,225, which fired a false
  // "per-day goals are on the prior target" warning on Pulse and drew the Goal
  // Pace line from the retired plan's shape. Point both at col 22 instead, which
  // is the same curve the vs-pace delta already uses. If Jon rescales the
  // far-right block, this can go back to 28.
  goalCumulative:   22, // "Forecast Enrollments" = cumulative goal by this day
  plus10:           30, // "Plus 10%"  (still on the retired 1,225 basis)
  minus10:          31, // "Minus 10%" (still on the retired 1,225 basis)
} as const;

export async function getPacingDataV2(
  sheetId: string,
  opts: { goalsTab?: string; cohortLabels?: string[]; asOf?: Date } = {},
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
  const activeWharton = getActiveCohort('wharton', opts.asOf ?? nowET());
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
  const todayMs = new Date(opts.asOf ?? nowET()).setHours(0, 0, 0, 0);
  const todayRow = dataRows.reduce<string[] | null>((best, r) => {
    const raw = r[V2.date];
    if (!raw) return best;
    const rowMs = new Date(raw).setHours(0, 0, 0, 0);
    if (isNaN(rowMs) || rowMs > todayMs) return best;
    if (!best) return r;
    const bestMs = new Date(best[V2.date]).setHours(0, 0, 0, 0);
    return rowMs > bestMs ? r : best;
  }, null);

  // daysRemaining stays on TODAY's row — it's a genuine countdown to the
  // deadline, distinct from the day the data runs through.
  const daysRemaining = N(todayRow?.[V2.daysBeforeDeadline]) ?? 0;
  const currentForecast = N(todayRow?.[V2.forecastEnrollments]) ?? 0;

  // The last row that has actually been KEYED. The tab pre-fills 0 into future
  // and not-yet-entered rows while the cumulative column carries the running
  // total forward, so on Aug 13 the Aug 13 row read 130 with a 0 daily actual
  // and Aug 12 (day 62) was the last real figure, also 130.
  //
  // Everything the comparison needs is read from THIS row — the enrolled total,
  // the pace it's measured against, and the days-out the prior cohorts are
  // looked up at — so all three are on one day by construction. Previously the
  // pace used "yesterday" as a stand-in for this and the historical lookup used
  // today, which is what put the prior cohorts a day ahead of us: at day 61 they
  // showed 139/132/104, at the aligned day 62 they show 134/127/98.
  const keyedRow = dataRows.reduce<string[] | null>((best, r) => {
    const raw = r[V2.date];
    if (!raw) return best;
    const rowMs = new Date(raw).setHours(0, 0, 0, 0);
    if (isNaN(rowMs) || rowMs > todayMs) return best;
    const daily = N(r[V2.dailyActual]);
    if (daily === null || daily <= 0) return best;
    if (!best) return r;
    return rowMs > new Date(best[V2.date]).setHours(0, 0, 0, 0) ? r : best;
  }, null);

  const currentGoalAtDay = N(keyedRow?.[V2.forecastEnrollments]) ?? N(todayRow?.[V2.forecastEnrollments]) ?? 0;
  const comparisonDay = N(keyedRow?.[V2.daysBeforeDeadline]) ?? daysRemaining;
  const dataThrough = keyedRow?.[V2.date] ?? null;
  // Read at the keyed row for the same reason. The cumulative column carries
  // forward, so this equals today's row whenever today is unkeyed — but it stays
  // correct on a day that IS keyed, where the old todayRow read silently paired
  // a fresh total against a stale pace.
  const currentEnrolled = N(keyedRow?.[V2.totalEnrollments]) ?? N(todayRow?.[V2.totalEnrollments]) ?? 0;

  // --- Historical cohort comparison, at the days-out the CURRENT figure is on ---
  // Pulled from the V1 sheet's per-day historical columns (see fetchHistoricalWhartonMap)
  // so "Closed Cohorts" and "vs. Last 3 cohort avg" are apples-to-apples with Fall '26's
  // current pace, not each cohort's fully-finished final total.
  const historicalSheetId = process.env.GOOGLE_PACING_SHEET_ID;
  const historicalMap = historicalSheetId ? await fetchHistoricalWhartonMap(historicalSheetId) : new Map<number, Array<{ label: string; pct: number; raw: number; final: number }>>();

  const findHistEntriesAtDay = (targetDay: number): Array<{ label: string; pct: number; raw: number; final: number }> => {
    let bestDay: number | null = null;
    for (const day of historicalMap.keys()) {
      if (bestDay === null || Math.abs(day - targetDay) < Math.abs(bestDay - targetDay)) bestDay = day;
    }
    return bestDay !== null ? historicalMap.get(bestDay)! : [];
  };
  const last3AtDay = findHistEntriesAtDay(comparisonDay).slice(-3);

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

  const histCohorts: Array<{ label: string; enrolled: number; goal: number; pctOfGoal: number; pctComplete: number; finalTotal: number | null }> =
    last3AtDay.length === 3
      ? last3AtDay.map(h => {
          const goal = getWGoal(h.label) ?? 0;
          return {
            label: h.label,
            enrolled: h.raw,
            goal,
            pctOfGoal: goal > 0 ? +(h.raw / goal * 100).toFixed(1) : 0,
            pctComplete: h.final ? +(h.raw / h.final * 100).toFixed(1) : +h.pct.toFixed(1),
            finalTotal: h.final ?? null,
          };
        })
      : ([
          { label: "Fall '25",   enrolled: findSummaryVal('fall 2025') ?? 883,    goal: W_GOALS["Fall '25"]   ?? 897  },
          { label: "Winter '26", enrolled: findSummaryVal('winter 2026') ?? 1020, goal: W_GOALS["Winter '26"] ?? 1021 },
          { label: "Spring '26", enrolled: findSummaryVal('spring') ?? 1003,      goal: W_GOALS["Spring '26"] ?? 1225 }, // "Spring 206" typo in sheet
        ]).map(c => ({ ...c, pctOfGoal: c.goal > 0 ? +(c.enrolled / c.goal * 100).toFixed(1) : 0, pctComplete: 100, finalTotal: c.enrolled }));

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
    dataThrough: dataThrough ? ymdOf(dataThrough) : undefined,
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
    // The day the panel is actually compared AT, which the UI labels ("Compared
    // at N days out"). Deliberately not the summary card's countdown: that is a
    // true days-to-deadline figure, while this is the day the enrollment numbers
    // on both sides of the comparison are keyed to.
    daysRemaining: comparisonDay,
    activeRow: {
      label: "Fall '26",
      enrolled: currentEnrolled,
      goal: finalGoal,
      pctOfGoal: +(currentEnrolled / finalGoal * 100).toFixed(1),
      // Fall '26 is still in progress — its own eventual final isn't known yet.
      pctComplete: daysRemaining === 0 ? 100 : null,
      finalTotal: daysRemaining === 0 ? currentEnrolled : null,
      isActive: true,
    },
    last3Avg: {
      enrolled: last3AvgEnrolled,
      goal: last3AvgGoal,
      pctOfGoal: last3AvgPctOfGoal,
      pctComplete: last3AvgPctComplete,
      finalTotal: Math.round(avgHist(c => c.finalTotal ?? 0)) || null,
    },
    closedRows: [...histCohorts].reverse().map(c => ({
      label: c.label,
      enrolled: c.enrolled,
      goal: c.goal,
      pctOfGoal: c.pctOfGoal,
      pctComplete: c.pctComplete,
      finalTotal: c.finalTotal,
      isActive: false,
    })),
    // The day-aligned path (last3AtDay) yields same-day-out pace values; only the
    // fallback below it reads each cohort's finished total from the summary block.
    basis: last3AtDay.length === 3 ? 'same-day-out' : 'finals',
  };

  return {
    summary,
    pacing,
    comparison: { wharton: wComparison, cbsee: null },
    programs: ['wharton'],
  };
}

// ---------------------------------------------------------------------------
// Current-cohort view for /enrollment: Wharton and CBSEE side by side.
//
// The two programs no longer live in one sheet. Wharton Fall '26 has its own
// cohort doc (V2 deadline table); CBSEE Fall '26's day-by-day curve and its
// historical cohort curves are still in the shared AN Summary pacing sheet,
// while its headline numbers (enrolled / goal / days remaining / goal pace)
// come from the CBS cohort doc — the same source Pulse and Cohort Command read,
// so the three surfaces cannot disagree on the enrollment figure.
// ---------------------------------------------------------------------------

export interface CbseeDocSource {
  sheetId: string;
  deadlineTab: string;
  goalsTab: string;
  /** Season+year labels to match in the goals tab, e.g. ["Fall 2026", "Fall '26"]. */
  goalLabels: string[];
}

export async function getPacingDataCurrent(
  whartonDocId: string,
  opts: {
    whartonGoalsTab?: string;
    whartonCohortLabels?: string[];
    summarySheetId?: string;
    cbseeDoc?: CbseeDocSource;
    /** Render every source as of this day instead of today. */
    asOf?: Date;
    /** The same day expressed as days-out per program, for the date-less AN Summary. */
    asOfDay?: { wharton?: number; cbsee?: number };
  } = {},
): Promise<{
  summary: CohortSummary[];
  pacing: PacingDataPoint[];
  comparison: { wharton: ComparisonPanel; cbsee: ComparisonPanel | null };
  programs: string[];
}> {
  if (isDemo()) return getDemoPacing();

  const summarySheetId = opts.summarySheetId ?? process.env.GOOGLE_PACING_SHEET_ID;

  const [wharton, summary, cbseeToday, cbseeGoal] = await Promise.all([
    getPacingDataV2(whartonDocId, { goalsTab: opts.whartonGoalsTab, cohortLabels: opts.whartonCohortLabels, asOf: opts.asOf }),
    // CBSEE curves are a bonus — a failure here must not take Wharton down with it.
    summarySheetId ? getPacingData(summarySheetId, { asOfDay: opts.asOfDay }).catch(() => null) : Promise.resolve(null),
    opts.cbseeDoc ? readDeadlineTable(opts.cbseeDoc.sheetId, opts.cbseeDoc.deadlineTab, 'CBSEE', opts.asOf) : Promise.resolve(null),
    opts.cbseeDoc ? readDocGoal(opts.cbseeDoc.sheetId, opts.cbseeDoc.goalsTab, opts.cbseeDoc.goalLabels) : Promise.resolve(null),
  ]);

  const cSummary = summary?.summary.find(s => s.program === 'CBSEE');
  const cPanel = summary?.comparison.cbsee ?? null;
  if (!cSummary || !cPanel) return wharton;

  // Cohort-doc values win; the AN Summary is the fallback for each field.
  const enrolled = cbseeToday?.cohortToDate ?? cSummary.enrolled;
  const goal = cbseeGoal?.goal ?? cSummary.goal;
  // Days remaining is the calendar countdown from the cohort doc's today row, so
  // /enrollment, /pulse and /cohort-performance all show the same number. The
  // comparison panel keeps its own basis — the AN Summary row the CBSEE actuals
  // were read at, one day back because enrollment counts are prior-day totals.
  const daysRemaining = cbseeToday?.daysRemaining ?? cSummary.daysRemaining;
  const goalPace = cbseeToday?.goalYesterday ?? cbseeToday?.goalToDate ?? cSummary.forecast;
  const pct = goal > 0 ? (enrolled / goal * 100).toFixed(1) : '0.0';
  const vsPace = enrolled - goalPace;

  const cbseeSummary: CohortSummary = {
    ...cSummary,
    goal,
    enrolled,
    daysRemaining,
    forecast: goalPace,
    goalSource: cbseeGoal?.source ?? 'built-in CBSEE goal map (no cohort-doc goals tab reachable)',
    keyTakeaway:
      `${cSummary.cohort} has enrolled ${enrolled.toLocaleString()} of ${goal.toLocaleString()} students (${pct}%) ` +
      `with ${daysRemaining} days remaining` +
      (goalPace > 0
        ? `, ${vsPace >= 0 ? `running ${vsPace} ahead of` : `falling ${-vsPace} behind`} the ${goalPace.toLocaleString()}-enrollment goal pace`
        : '') +
      `, vs. ${cSummary.histAvg.toLocaleString()} for the last 3 cohorts at this point.`,
  };

  // Join the two pacing series on days-remaining — both tables use it as their
  // x-axis. Union of days, so neither program's curve gets clipped by the other's
  // shorter enrollment window.
  const byDay = new Map<number, PacingDataPoint>();
  for (const pt of wharton.pacing) byDay.set(pt.day, { ...pt });
  for (const pt of summary!.pacing) {
    const existing = byDay.get(pt.day);
    const cFields = {
      cHistoricals: pt.cHistoricals,
      cActualPct: pt.cActualPct,
      cLast3Pct: pt.cLast3Pct,
      cActual: pt.cActual,
      cForecast: pt.cForecast,
    };
    if (existing) Object.assign(existing, cFields);
    else {
      // Days outside the Wharton cohort's window (CBSEE enrolls over a longer
      // run-up). The AN Summary still has the Wharton historical curves there,
      // computed the same way, so carry them rather than leaving a hole.
      byDay.set(pt.day, {
        day: pt.day,
        wHistoricals: pt.wHistoricals,
        wLast3Pct: pt.wLast3Pct,
        ...cFields,
      });
    }
  }
  // Ascending by day (day 0 first), matching what both underlying readers emit —
  // consumers that walk the series in order shouldn't see a different convention
  // just because the two sources were merged.
  const pacing = [...byDay.values()].sort((a, b) => a.day - b.day);

  return {
    summary: [...wharton.summary, cbseeSummary],
    pacing,
    comparison: {
      wharton: wharton.comparison.wharton,
      cbsee: {
        ...cPanel,
        activeRow: {
          ...cPanel.activeRow,
          enrolled,
          goal,
          pctOfGoal: goal > 0 ? +(enrolled / goal * 100).toFixed(1) : 0,
        },
      },
    },
    programs: ['wharton', 'cbsee'],
  };
}
