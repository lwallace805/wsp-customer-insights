// ─── Wharton paid budget plan — reader + plan-vs-actual join ──────────────────
//
// Source: the marketing team's budget workbook for a cohort, e.g. "Wharton
// Winter 2027 - Paid Marketing Channels Budget Plan". It is a PLAN, not the
// funnel-analysis doc /paid-aggregate reads and not the cohort performance doc.
// Two tabs matter, both resolved by highest version number ("… V3"):
//
//   "Budget Pacing (Wharton V<n>)"      — planned paid spend by cohort week
//   "Summary Dashboard (Wharton V<n>)"  — the Executive Budget Summary
//
// The workbook also carries "Budget Pacing (Wharton) - Budgeting 17 Weeks" and
// "… - Budgting " (sic). Those are working drafts: as of 2026-10-29 the first
// totals $972,854 and the second keeps $981,000 but on a different channel
// split (Google 591K / Meta 200K / LinkedIn 80K / Bing 110K). Only the
// versioned tab reconciles to the Executive Budget Summary, so the unversioned
// drafts are never read.
//
// Pacing tab layout (verified 2026-10-29 against V3):
//   r1  A "Winter 2027 — Weekly Budget Pacing Plan" | M "Weekly Spend" | AF "Daily Spend"
//   r2  bucket label per week column ("Pre-window", "61-90d", …, "$0 — Post-cohort")
//   r3  B "All Paid Ads" | week numbers 1..18 under both headers
//   r4  B "Program" C "Spend" D "CPE" … | date ranges "10/14-10/19" … under both
//   r5… one row per program (Brand/All, FP&A, PE, RE, AVI, RDI) — cohort totals only
//   r11 B "TOTAL" — cohort total, then the weekly and daily plan across the columns
//   r13 A "Google Ads" | r14 header: Program, Campaign Type, Campaign Name, Opt. Event,
//       Spend, … | r15… campaign rows with weekly + daily plan | r26 A "TOTAL"
//   then the same shape for "Meta Ads", "LinkedIn Ads", "Bing Ads".
// Everything is located by label — the "Weekly Spend"/"Daily Spend" anchors,
// the "<Channel> Ads" block titles, the "Program" header and "TOTAL" rows — so
// an inserted row or campaign doesn't repoint us. Daily cells read "OFF" for a
// campaign not yet live; that is a planned $0, not a parse failure.
//
// Reconciliation, re-checked on every read (any failure withholds the block
// and names it in `notes`):
//   • each channel block: campaigns sum to the block's TOTAL row, per week and
//     in total; the TOTAL row's weeks sum to its cohort total
//   • the channel TOTAL rows sum to the All Paid TOTAL row, per week
//   • the All Paid programs and weeks each sum to the cohort total budget
//   • the Executive Summary's channel mix and program matrix sum to their own
//     TOTAL rows and agree with the pacing tab's channel totals
//
// The join: planned spend accumulated to the current cohort week vs the active
// cohort doc's "Paid WoW Performance & Goals" cohort-to-date actuals, read
// through readPaidWoW() — the same reader Pulse and /paid-aggregate use.
// Alignment basis is WEEK-FROM-OPEN as both sheets key it: week 1 is the
// partial week from the Tuesday the cohort opened (10/14-10/19 for Winter
// 2027), then Monday–Sunday weeks. The budget workbook and the cohort doc use
// identical week boundaries, so the comparison needs no re-bucketing.
//
// INTERNAL ONLY. Nothing here is imported by src/lib/whartonPartner.ts or any
// /wharton route; the external partner page must never show budget figures.

import { google } from 'googleapis';
import { readPaidWoW } from '@/lib/sheets';
import type { PaidWoW } from '@/lib/sheets';
import { getActiveCohortSheet } from '@/lib/cohortSheets';
import {
  getActiveCohort, getCohortWeek, nowET, todayET, type CohortWindow,
} from '@/lib/cohortCalendar';
import { getServiceAccountEmail } from './paidAggregate';
import { BUDGET_CHANNELS } from './budgetPlanTypes';
import type {
  BudgetChannel, BudgetPlan, BudgetPacingChannel, BudgetPacingData, BudgetPacingWeek,
  BucketPlan, ChannelMixRow, ChannelPlan, OverviewRow, PlanCampaign, PlanCheck, PlanWeek,
  ProgramChannelRow, ProgramPlan,
} from './budgetPlanTypes';

export type { BudgetPlan, BudgetPacingData } from './budgetPlanTypes';

// ─── Which workbook backs which cohort ───────────────────────────────────────
// A budget workbook is per cohort, so it is keyed by the calendar's cohort key
// (like COHORT_SHEETS). Reading last cohort's plan against this cohort's
// actuals would be silently wrong, so an unwired cohort reads as "not wired"
// rather than falling back to the previous workbook.

export const BUDGET_PLAN_DOCS: Record<string, (() => string | undefined) | undefined> = {
  // "Wharton Winter 2027 - Paid Marketing Channels Budget Plan" (owner kta@)
  'w-winter-27': () => process.env.WINTER27_BUDGET_PLAN_DOC_ID ?? '13Ze0z8c_2-lA5xFRoVSiH6kDDD7ycyrX_zsRk78qngI',
};

export function budgetPlanDocId(cohortKey: string | undefined): string | undefined {
  return cohortKey ? BUDGET_PLAN_DOCS[cohortKey]?.() : undefined;
}

const PACING_TAB_RE = /^Budget Pacing \(Wharton V(\d+)\)\s*$/i;
const SUMMARY_TAB_RE = /^Summary Dashboard \(Wharton V(\d+)\)\s*$/i;

export type BudgetPacingResult =
  | { ok: true; data: BudgetPacingData }
  | { ok: false; needsAccess: boolean; error: string; sheetId: string | null };

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

// ─── Cell helpers ─────────────────────────────────────────────────────────────

type Grid = unknown[][];

function S(v: unknown): string {
  return String(v ?? '').trim();
}

/** Unformatted cells arrive as numbers; "-", "OFF", blanks and errors → null. */
function N(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === '' || s === '-' || /^off$/i.test(s) || s.startsWith('#') || /^-%$/.test(s)) return null;
  const n = parseFloat(s.replace(/[$,%]/g, ''));
  return isNaN(n) ? null : n;
}

/** A planned-spend cell. Blank / "-" / "OFF" are a planned $0; anything else
 *  non-numeric (an error, stray text) is a parse failure the caller must
 *  treat as "this block can't be trusted". */
function money(v: unknown): number | 'bad' {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 'bad';
  const s = String(v).trim();
  if (s === '' || s === '-' || /^off$/i.test(s)) return 0;
  const n = parseFloat(s.replace(/[$,]/g, ''));
  return isNaN(n) ? 'bad' : n;
}

function cell(g: Grid, r: number, c: number): unknown {
  return g[r]?.[c];
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

/** Two money figures agree within a dollar (the sheet rounds some cells). */
function close(a: number, b: number, tol = 1): boolean {
  return Math.abs(a - b) <= tol;
}

function fmt$(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const DATE_RANGE_RE = /^(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})$/;

/** "12/29-1/4" → start/end dates. The year comes from the cohort's open date:
 *  a month before the opening month belongs to the following year, and an end
 *  month earlier than the start month rolls over too. */
function datesFor(range: string, opens: string): { start: string; end: string; days: number } | null {
  const m = range.match(DATE_RANGE_RE);
  if (!m) return null;
  const [oy, om] = opens.split('-').map(Number);
  const m1 = Number(m[1]), d1 = Number(m[2]), m2 = Number(m[3]), d2 = Number(m[4]);
  const y1 = m1 >= om ? oy : oy + 1;
  const y2 = m2 >= m1 ? y1 : y1 + 1;
  const start = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (days < 1 || days > 14) return null;
  return { start: toYmd(start), end: toYmd(end), days };
}

function channelFor(label: string): BudgetChannel | null {
  const t = label.toLowerCase().replace(/\s*ads\s*$/, '').trim();
  if (t === 'google') return 'Google';
  if (t === 'bing' || t === 'microsoft') return 'Bing';
  if (t === 'meta' || t === 'facebook') return 'Meta';
  if (t === 'linkedin') return 'LinkedIn';
  return null;
}

/** Column index of the first header cell whose text starts with `needle`. */
function colOf(header: unknown[], needle: string, from = 0, to = header.length): number {
  const n = needle.toLowerCase();
  for (let i = from; i < to; i++) {
    const h = S(header[i]).toLowerCase().replace(/\s+/g, ' ');
    if (h !== '' && h.startsWith(n)) return i;
  }
  return -1;
}

// ─── Pacing tab ───────────────────────────────────────────────────────────────

interface Anchors {
  weeklyCol: number;
  dailyCol: number;
  bucketRow: number;
  weekRow: number;
  rangeRow: number;
  n: number;              // number of week columns
}

function findAnchors(g: Grid): Anchors | null {
  for (let r = 0; r < Math.min(g.length, 10); r++) {
    const row = g[r] ?? [];
    const weeklyCol = row.findIndex(c => /^weekly spend$/i.test(S(c)));
    const dailyCol = row.findIndex(c => /^daily spend$/i.test(S(c)));
    if (weeklyCol < 0 || dailyCol < 0) continue;
    let bucketRow = -1, weekRow = -1, rangeRow = -1;
    for (let k = r + 1; k < Math.min(r + 8, g.length); k++) {
      const v = cell(g, k, weeklyCol);
      if (weekRow < 0 && v === 1) weekRow = k;
      else if (rangeRow < 0 && DATE_RANGE_RE.test(S(v))) rangeRow = k;
      else if (bucketRow < 0 && typeof v === 'string' && S(v) !== '') bucketRow = k;
    }
    if (weekRow < 0 || rangeRow < 0 || bucketRow < 0) return null;
    // Count consecutive week numbers 1, 2, 3… on the week row.
    let n = 0;
    while (cell(g, weekRow, weeklyCol + n) === n + 1) n++;
    if (n < 4) return null;
    // The daily block must carry the same weeks.
    for (let i = 0; i < n; i++) {
      if (cell(g, weekRow, dailyCol + i) !== i + 1) return null;
      if (S(cell(g, rangeRow, dailyCol + i)) !== S(cell(g, rangeRow, weeklyCol + i))) return null;
    }
    return { weeklyCol, dailyCol, bucketRow, weekRow, rangeRow, n };
  }
  return null;
}

function readWeeks(g: Grid, a: Anchors, opens: string): PlanWeek[] | null {
  const out: PlanWeek[] = [];
  for (let i = 0; i < a.n; i++) {
    const dateRange = S(cell(g, a.rangeRow, a.weeklyCol + i));
    const d = datesFor(dateRange, opens);
    if (!d) return null;
    // Weeks must be contiguous and in order, or the to-date arithmetic is off.
    if (i > 0) {
      const prevEnd = parseYmd(out[i - 1].end);
      const next = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() + 1);
      if (toYmd(next) !== d.start) return null;
    }
    out.push({ week: i + 1, dateRange, ...d, bucket: S(cell(g, a.bucketRow, a.weeklyCol + i)) });
  }
  return out;
}

/** Read a run of money cells; null if any cell is unparseable. */
function readRun(row: unknown[], from: number, n: number): number[] | null {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = money(row[from + i]);
    if (v === 'bad') return null;
    out.push(v);
  }
  return out;
}

interface AllPaidBlock {
  total: number;
  weekly: number[];
  daily: number[];
  programs: ProgramPlan[];
  row: number;
}

/** The "All Paid Ads" block: a "Program" header whose next cell is "Spend"
 *  (the channel blocks put "Campaign Type" there instead). */
function readAllPaid(g: Grid, a: Anchors, checks: PlanCheck[], notes: string[], tab: string): AllPaidBlock | null {
  let hdr = -1, pcol = -1;
  for (let r = 0; r < g.length && hdr < 0; r++) {
    const row = g[r] ?? [];
    for (let c = 0; c < Math.min(row.length, 6); c++) {
      if (S(row[c]).toLowerCase() === 'program' && S(row[c + 1]).toLowerCase() === 'spend') { hdr = r; pcol = c; break; }
    }
  }
  if (hdr < 0) {
    notes.push(`The "All Paid Ads" block (a "Program | Spend" header) was not found in “${tab}”; the cohort total and program split are withheld.`);
    return null;
  }
  const header = g[hdr] ?? [];
  const col = {
    spend: pcol + 1,
    cpe: colOf(header, 'cpe', pcol, a.weeklyCol),
    enrolls: colOf(header, 'enrollment', pcol, a.weeklyCol),
    leads: colOf(header, 'leads', pcol, a.weeklyCol),
    cpl: colOf(header, 'cpl', pcol, a.weeklyCol),
    cvr: colOf(header, 'cvr', pcol, a.weeklyCol),
    roas: colOf(header, 'roas', pcol, a.weeklyCol),
  };
  const at = (row: unknown[], c: number) => (c >= 0 ? N(row[c]) : null);

  const programs: ProgramPlan[] = [];
  let totalRow = -1;
  for (let r = hdr + 1; r < Math.min(hdr + 20, g.length); r++) {
    const label = S(cell(g, r, pcol));
    if (!label) break;
    if (/^total$/i.test(label)) { totalRow = r; break; }
    const spend = money(cell(g, r, col.spend));
    if (spend === 'bad') {
      notes.push(`“${tab}” All Paid Ads: the ${label} spend cell isn't a number; the block is withheld.`);
      return null;
    }
    const row = g[r] ?? [];
    programs.push({
      program: label, spend,
      cpe: at(row, col.cpe), enrollments: at(row, col.enrolls), leads: at(row, col.leads),
      cpl: at(row, col.cpl), cvr: at(row, col.cvr), roas: at(row, col.roas),
    });
  }
  if (totalRow < 0 || programs.length === 0) {
    notes.push(`“${tab}” All Paid Ads: no TOTAL row under the program list; the block is withheld.`);
    return null;
  }
  const trow = g[totalRow] ?? [];
  const total = money(trow[col.spend]);
  const weekly = readRun(trow, a.weeklyCol, a.n);
  const daily = readRun(trow, a.dailyCol, a.n);
  if (total === 'bad' || !weekly || !daily) {
    notes.push(`“${tab}” All Paid Ads: the TOTAL row has a non-numeric cell; the block is withheld.`);
    return null;
  }

  const progSum = sum(programs.map(p => p.spend));
  const weekSum = sum(weekly);
  const c1 = close(progSum, total);
  const c2 = close(weekSum, total);
  checks.push({
    name: 'All Paid Ads: programs sum to TOTAL', ok: c1,
    detail: `${fmt$(progSum)} vs TOTAL ${fmt$(total)} (${tab}!${colLetter(col.spend)}${totalRow + 1})`,
  });
  checks.push({
    name: 'All Paid Ads: weekly plan sums to TOTAL', ok: c2,
    detail: `${fmt$(weekSum)} across ${a.n} weeks vs ${fmt$(total)}`,
  });
  if (!c1 || !c2) {
    notes.push(
      `“${tab}” All Paid Ads no longer reconciles (programs ${fmt$(progSum)}, weeks ${fmt$(weekSum)}, ` +
      `TOTAL ${fmt$(total)}); the cohort total and program split are withheld.`,
    );
    return null;
  }
  // Daily is weekly ÷ 7 in the sheet. Flag drift but don't withhold — the
  // weekly figures are what the headline uses.
  const off = weekly.map((w, i) => ({ i, w, d: daily[i] })).filter(x => !close(x.d * 7, x.w, 7));
  checks.push({
    name: 'All Paid Ads: daily plan is weekly ÷ 7', ok: off.length === 0,
    detail: off.length === 0 ? 'every week' : `off in week${off.length > 1 ? 's' : ''} ${off.map(x => x.i + 1).join(', ')}`,
  });
  return { total, weekly, daily, programs, row: totalRow };
}

function colLetter(i: number): string {
  let s = '';
  i += 1;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

function readChannelBlocks(
  g: Grid, a: Anchors, checks: PlanCheck[], notes: string[], tab: string,
): Partial<Record<BudgetChannel, ChannelPlan>> {
  const out: Partial<Record<BudgetChannel, ChannelPlan>> = {};
  for (let r = 0; r < g.length; r++) {
    const title = S(cell(g, r, 0));
    if (!/ads$/i.test(title)) continue;
    const ch = channelFor(title);
    if (!ch) continue;
    const hdr = r + 1;
    const header = g[hdr] ?? [];
    if (S(header[0]).toLowerCase() !== 'program') continue;
    const col = {
      type: colOf(header, 'campaign type', 0, a.weeklyCol),
      name: colOf(header, 'campaign name', 0, a.weeklyCol),
      opt: colOf(header, 'opt', 0, a.weeklyCol),
      spend: colOf(header, 'spend', 0, a.weeklyCol),
    };
    if (col.spend < 0) {
      notes.push(`“${tab}” ${title}: no "Spend" column in its header; the block is withheld.`);
      continue;
    }
    const campaigns: PlanCampaign[] = [];
    const dailyRows: number[][] = [];
    let totalRow = -1;
    let bad = false;
    for (let k = hdr + 1; k < Math.min(hdr + 40, g.length); k++) {
      const label = S(cell(g, k, 0));
      if (!label) break;
      if (/^total$/i.test(label)) { totalRow = k; break; }
      const row = g[k] ?? [];
      const spend = money(row[col.spend]);
      const weekly = readRun(row, a.weeklyCol, a.n);
      const daily = readRun(row, a.dailyCol, a.n);
      if (spend === 'bad' || !weekly || !daily) { bad = true; break; }
      campaigns.push({
        program: label,
        campaignType: col.type >= 0 ? S(row[col.type]) : '',
        name: col.name >= 0 ? S(row[col.name]) : '',
        optEvent: col.opt >= 0 ? S(row[col.opt]) : '',
        spend, weekly,
      });
      dailyRows.push(daily);
    }
    if (bad || totalRow < 0 || campaigns.length === 0) {
      notes.push(`“${tab}” ${title}: ${bad ? 'a campaign row has a non-numeric plan cell' : 'no TOTAL row closes the campaign list'}; the ${ch} plan is withheld.`);
      continue;
    }
    const trow = g[totalRow] ?? [];
    const total = money(trow[col.spend]);
    const weekly = readRun(trow, a.weeklyCol, a.n);
    const daily = readRun(trow, a.dailyCol, a.n);
    if (total === 'bad' || !weekly || !daily) {
      notes.push(`“${tab}” ${title}: the TOTAL row has a non-numeric cell; the ${ch} plan is withheld.`);
      continue;
    }

    // Reconcile: campaigns → TOTAL per week (weekly and daily), TOTAL weeks → TOTAL spend,
    // campaign spends → TOTAL spend.
    const weekOff: number[] = [];
    const dayOff: number[] = [];
    for (let i = 0; i < a.n; i++) {
      if (!close(sum(campaigns.map(c => c.weekly[i])), weekly[i])) weekOff.push(i + 1);
      if (!close(sum(dailyRows.map(d => d[i])), daily[i])) dayOff.push(i + 1);
    }
    const campSum = sum(campaigns.map(c => c.spend));
    const weekSum = sum(weekly);
    const ok1 = weekOff.length === 0;
    const ok2 = close(campSum, total);
    const ok3 = close(weekSum, total);
    const ok4 = dayOff.length === 0;
    checks.push({
      name: `${ch}: campaigns sum to TOTAL each week`, ok: ok1,
      detail: ok1 ? `${campaigns.length} campaigns × ${a.n} weeks` : `off in week${weekOff.length > 1 ? 's' : ''} ${weekOff.join(', ')}`,
    });
    checks.push({
      name: `${ch}: campaign spends sum to TOTAL`, ok: ok2,
      detail: `${fmt$(campSum)} vs ${fmt$(total)} (${tab}!${colLetter(col.spend)}${totalRow + 1})`,
    });
    checks.push({
      name: `${ch}: weekly plan sums to TOTAL`, ok: ok3,
      detail: `${fmt$(weekSum)} vs ${fmt$(total)}`,
    });
    checks.push({
      name: `${ch}: daily plan sums to TOTAL each week`, ok: ok4,
      detail: ok4 ? 'every week' : `off in week${dayOff.length > 1 ? 's' : ''} ${dayOff.join(', ')}`,
    });
    if (!ok1 || !ok2 || !ok3 || !ok4) {
      notes.push(
        `“${tab}” ${title} no longer reconciles to its own TOTAL row` +
        `${!ok1 ? ` (weekly, week${weekOff.length > 1 ? 's' : ''} ${weekOff.join(', ')})` : ''}` +
        `${!ok4 ? ` (daily, week${dayOff.length > 1 ? 's' : ''} ${dayOff.join(', ')})` : ''}` +
        `${!ok2 ? ` (campaigns ${fmt$(campSum)} vs ${fmt$(total)})` : ''}` +
        `${!ok3 ? ` (weeks ${fmt$(weekSum)} vs ${fmt$(total)})` : ''}` +
        `; the ${ch} plan is withheld.`,
      );
      continue;
    }
    out[ch] = { channel: ch, total, weekly, daily, campaigns, source: `${tab}!A${r + 1}` };
  }
  return out;
}

function bucketsFrom(weeks: PlanWeek[], channels: Partial<Record<BudgetChannel, ChannelPlan>>): BucketPlan[] | null {
  const present = BUDGET_CHANNELS.filter(ch => channels[ch]);
  if (present.length === 0) return null;
  const out: BucketPlan[] = [];
  for (const w of weeks) {
    let b = out.find(x => x.bucket === w.bucket);
    if (!b) {
      b = { bucket: w.bucket, weeks: [], total: 0, byChannel: { Google: 0, Bing: 0, Meta: 0, LinkedIn: 0 } };
      out.push(b);
    }
    b.weeks.push(w.week);
    for (const ch of present) {
      const v = channels[ch]!.weekly[w.week - 1] ?? 0;
      b.byChannel[ch] += v;
      b.total += v;
    }
  }
  return out;
}

// ─── Executive Budget Summary tab ─────────────────────────────────────────────

interface Summary {
  priorLabel: string;
  planLabel: string;
  overview: OverviewRow[] | null;
  channelMix: ChannelMixRow[] | null;
  programByChannel: ProgramChannelRow[] | null;
}

/** Row index of the section whose column-A title starts with `prefix` (and
 *  contains `also`, when given — the program spend summary appears once per
 *  cohort and only the "… Plan" one is wanted). */
function sectionRow(g: Grid, prefix: string, also?: string): number {
  for (let r = 0; r < g.length; r++) {
    const t = S(cell(g, r, 0)).toLowerCase();
    if (t.startsWith(prefix.toLowerCase()) && (!also || t.includes(also.toLowerCase()))) return r;
  }
  return -1;
}

function readSummary(g: Grid, tab: string, checks: PlanCheck[], notes: string[]): Summary | null {
  if (!g.length) return null;
  let priorLabel = 'Prior cohort actual';
  let planLabel = 'Plan';

  // ── BUDGET OVERVIEW: Metric | <prior> Actual | <cohort> Plan | CoC $ | CoC % ──
  let overview: OverviewRow[] | null = null;
  const ov = sectionRow(g, 'BUDGET OVERVIEW');
  if (ov >= 0) {
    const header = g[ov + 1] ?? [];
    const cPrior = header.findIndex(h => /actual/i.test(S(h)));
    const cPlan = header.findIndex(h => /plan/i.test(S(h)));
    const cDollar = header.findIndex(h => /coc change \(\$\)/i.test(S(h)));
    const cPct = header.findIndex(h => /coc change \(%\)/i.test(S(h)));
    if (S(header[0]).toLowerCase() === 'metric' && cPrior > 0 && cPlan > 0) {
      priorLabel = S(header[cPrior]);
      planLabel = S(header[cPlan]);
      overview = [];
      for (let r = ov + 2; r < Math.min(ov + 20, g.length); r++) {
        const metric = S(cell(g, r, 0));
        if (!metric) break;
        const row = g[r] ?? [];
        overview.push({
          metric,
          priorActual: N(row[cPrior]),
          plan: N(row[cPlan]),
          cocDollar: cDollar >= 0 ? N(row[cDollar]) : null,
          cocPct: cPct >= 0 ? N(row[cPct]) : null,
        });
      }
    }
  }

  // ── CHANNEL MIX: Channel | Budget ($) | % of Total | Proj. … ──
  let channelMix: ChannelMixRow[] | null = null;
  const cm = sectionRow(g, 'CHANNEL MIX');
  if (cm >= 0) {
    const header = g[cm + 1] ?? [];
    const col = {
      budget: colOf(header, 'budget'),
      share: colOf(header, '% of total'),
      enrolls: colOf(header, 'proj. enrollments'),
      cpe: colOf(header, 'proj. blended cpe'),
      leads: colOf(header, 'proj. leads'),
      cpl: colOf(header, 'proj. cpl'),
    };
    if (S(header[0]).toLowerCase() === 'channel' && col.budget > 0) {
      const rows: ChannelMixRow[] = [];
      let total: ChannelMixRow | null = null;
      for (let r = cm + 2; r < Math.min(cm + 12, g.length); r++) {
        const label = S(cell(g, r, 0));
        if (!label) break;
        const row = g[r] ?? [];
        const at = (c: number) => (c >= 0 ? N(row[c]) : null);
        const entry: ChannelMixRow = {
          channel: label, budget: at(col.budget), share: at(col.share),
          projEnrollments: at(col.enrolls), projCpe: at(col.cpe), projLeads: at(col.leads), projCpl: at(col.cpl),
        };
        if (/^total$/i.test(label)) { total = entry; break; }
        rows.push(entry);
      }
      if (total && rows.length) {
        const s = sum(rows.map(r => r.budget ?? 0));
        const ok = total.budget !== null && close(s, total.budget);
        checks.push({
          name: 'Executive Summary: channel mix sums to TOTAL', ok,
          detail: `${fmt$(s)} vs ${total.budget === null ? '—' : fmt$(total.budget)} (${tab}!${colLetter(col.budget)}${cm + 3 + rows.length})`,
        });
        if (ok) channelMix = [...rows, total];
        else notes.push(`“${tab}” channel mix no longer sums to its TOTAL row (${fmt$(s)} vs ${total.budget === null ? '—' : fmt$(total.budget)}); the table is withheld.`);
      }
    }
  }

  // ── PROGRAM SPEND SUMMARY — … Plan: Program | Google | Bing | Meta | LinkedIn | Total | Enrollments | CPE ──
  let programByChannel: ProgramChannelRow[] | null = null;
  const ps = sectionRow(g, 'PROGRAM SPEND SUMMARY', 'plan');
  if (ps >= 0) {
    const header = g[ps + 1] ?? [];
    const col = {
      Google: colOf(header, 'google'), Bing: colOf(header, 'bing'),
      Meta: colOf(header, 'meta'), LinkedIn: colOf(header, 'linkedin'),
      total: colOf(header, 'total'), enrolls: colOf(header, 'enrollments'), cpe: colOf(header, 'cpe'),
    };
    if (S(header[0]).toLowerCase() === 'program' && col.total > 0) {
      const rows: ProgramChannelRow[] = [];
      let total: ProgramChannelRow | null = null;
      let rowOff: string[] = [];
      for (let r = ps + 2; r < Math.min(ps + 14, g.length); r++) {
        const label = S(cell(g, r, 0));
        if (!label) break;
        const row = g[r] ?? [];
        const at = (c: number) => (c >= 0 ? N(row[c]) : null);
        const entry: ProgramChannelRow = {
          program: label,
          byChannel: { Google: at(col.Google), Bing: at(col.Bing), Meta: at(col.Meta), LinkedIn: at(col.LinkedIn) },
          total: at(col.total), enrollments: at(col.enrolls), cpe: at(col.cpe),
        };
        const chSum = sum(BUDGET_CHANNELS.map(ch => entry.byChannel[ch] ?? 0));
        if (entry.total === null || !close(chSum, entry.total)) rowOff.push(label);
        if (/^total$/i.test(label)) { total = entry; break; }
        rows.push(entry);
      }
      if (total && rows.length) {
        const s = sum(rows.map(r => r.total ?? 0));
        const okRows = rowOff.length === 0;
        const okTotal = total.total !== null && close(s, total.total);
        checks.push({
          name: 'Executive Summary: program rows sum across channels', ok: okRows,
          detail: okRows ? `${rows.length} programs + TOTAL` : `off: ${rowOff.join(', ')}`,
        });
        checks.push({
          name: 'Executive Summary: programs sum to TOTAL', ok: okTotal,
          detail: `${fmt$(s)} vs ${total.total === null ? '—' : fmt$(total.total)}`,
        });
        if (okRows && okTotal) programByChannel = [...rows, total];
        else notes.push(`“${tab}” program spend summary no longer reconciles (${!okRows ? `rows: ${rowOff.join(', ')}` : `programs ${fmt$(s)} vs TOTAL ${total.total === null ? '—' : fmt$(total.total)}`}); the matrix is withheld.`);
      }
      rowOff = [];
    }
  }

  if (!overview && !channelMix && !programByChannel) return null;
  return { priorLabel, planLabel, overview, channelMix, programByChannel };
}

// ─── Tab resolution ───────────────────────────────────────────────────────────

interface TabInfo { title: string; hidden: boolean }

function pickVersioned(tabs: TabInfo[], re: RegExp): { tab: TabInfo; version: number } | null {
  let best: { tab: TabInfo; version: number } | null = null;
  for (const t of tabs) {
    const m = t.title.match(re);
    if (!m) continue;
    const v = parseInt(m[1], 10);
    if (!best || v > best.version) best = { tab: t, version: v };
  }
  return best;
}

// ─── Plan reader ──────────────────────────────────────────────────────────────

export async function readBudgetPlan(sheetId: string, opens: string): Promise<BudgetPlan> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: 'properties.title,sheets.properties(title,hidden)',
  });
  const docTitle = meta.data.properties?.title ?? 'Budget plan';
  const tabs: TabInfo[] = (meta.data.sheets ?? [])
    .map(s => ({ title: s.properties?.title ?? '', hidden: !!s.properties?.hidden }))
    .filter(t => t.title);

  const notes: string[] = [];
  const checks: PlanCheck[] = [];
  const pacing = pickVersioned(tabs, PACING_TAB_RE);
  const summary = pickVersioned(tabs, SUMMARY_TAB_RE);
  if (!pacing) {
    throw new Error(`No "Budget Pacing (Wharton V<n>)" tab in “${docTitle}” — tabs: ${tabs.map(t => t.title).join(', ')}`);
  }
  if (pacing.tab.hidden) notes.push(`The newest pacing tab “${pacing.tab.title}” is hidden in the workbook — check that it is still the live plan.`);
  if (summary && summary.version !== pacing.version) {
    notes.push(`The pacing tab is V${pacing.version} but the newest Executive Summary is V${summary.version}; the two may describe different plans.`);
  }

  const ranges = [`'${pacing.tab.title}'!A1:AZ200`, ...(summary ? [`'${summary.tab.title}'!A1:P120`] : [])];
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId, ranges, valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const grids = (res.data.valueRanges ?? []).map(v => (v.values ?? []) as Grid);
  const g = grids[0] ?? [];
  const sg = grids[1] ?? [];
  const tab = pacing.tab.title;

  const anchors = findAnchors(g);
  let weeks: PlanWeek[] = [];
  let allPaid: BudgetPlan['allPaid'] = null;
  let channels: Partial<Record<BudgetChannel, ChannelPlan>> = {};
  if (!anchors) {
    notes.push(`“${tab}”: the "Weekly Spend" / "Daily Spend" week headers were not found, so no plan could be read.`);
  } else {
    const w = readWeeks(g, anchors, opens);
    if (!w) {
      notes.push(`“${tab}”: the week date ranges don't parse as contiguous weeks, so no plan could be read.`);
    } else {
      weeks = w;
      const ap = readAllPaid(g, anchors, checks, notes, tab);
      channels = readChannelBlocks(g, anchors, checks, notes, tab);
      if (ap) allPaid = { total: ap.total, weekly: ap.weekly, daily: ap.daily, programs: ap.programs };

      // Cross-block: the channel TOTAL rows must sum to the All Paid TOTAL row.
      const present = BUDGET_CHANNELS.filter(ch => channels[ch]);
      if (ap && present.length === 4) {
        const off: number[] = [];
        for (let i = 0; i < anchors.n; i++) {
          if (!close(sum(present.map(ch => channels[ch]!.weekly[i])), ap.weekly[i])) off.push(i + 1);
        }
        const chTotal = sum(present.map(ch => channels[ch]!.total));
        const okW = off.length === 0;
        const okT = close(chTotal, ap.total);
        checks.push({
          name: 'Channel TOTAL rows sum to All Paid each week', ok: okW,
          detail: okW ? `${anchors.n} weeks` : `off in week${off.length > 1 ? 's' : ''} ${off.join(', ')}`,
        });
        checks.push({
          name: 'Channel totals sum to the cohort budget', ok: okT,
          detail: `${present.map(ch => `${ch} ${fmt$(channels[ch]!.total)}`).join(' + ')} = ${fmt$(chTotal)} vs ${fmt$(ap.total)}`,
        });
        if (!okW || !okT) {
          notes.push(
            `The four channel blocks no longer sum to the All Paid TOTAL row` +
            `${!okT ? ` (${fmt$(chTotal)} vs ${fmt$(ap.total)})` : ''}` +
            `${!okW ? ` in week${off.length > 1 ? 's' : ''} ${off.join(', ')}` : ''}; ` +
            'the cohort total is withheld and each channel is shown on its own block.',
          );
          allPaid = null;
        }
      } else if (ap && present.length < 4) {
        notes.push(`Only ${present.length} of 4 channel blocks reconciled, so the channel-vs-cohort cross-check could not run.`);
      }
    }
  }

  const sm = sg.length ? readSummary(sg, summary!.tab.title, checks, notes) : null;
  if (summary && !sm) notes.push(`“${summary.tab.title}” carried none of the expected sections (Budget Overview, Channel Mix, Program Spend Summary).`);

  // Executive Summary vs pacing tab: the channel mix and the channel blocks are
  // two statements of the same budget and must agree.
  if (sm?.channelMix) {
    const off: string[] = [];
    for (const ch of BUDGET_CHANNELS) {
      const plan = channels[ch];
      const mix = sm.channelMix.find(r => channelFor(r.channel) === ch);
      if (plan && mix && mix.budget !== null && !close(plan.total, mix.budget)) off.push(`${ch} ${fmt$(plan.total)} vs ${fmt$(mix.budget)}`);
    }
    const mixTotal = sm.channelMix.find(r => /^total$/i.test(r.channel))?.budget ?? null;
    if (allPaid && mixTotal !== null && !close(allPaid.total, mixTotal)) off.push(`total ${fmt$(allPaid.total)} vs ${fmt$(mixTotal)}`);
    checks.push({
      name: 'Pacing channel totals match the Executive Summary channel mix', ok: off.length === 0,
      detail: off.length === 0
        ? (allPaid ? `cohort budget ${fmt$(allPaid.total)} on both tabs` : 'per channel')
        : off.join('; '),
    });
    if (off.length) notes.push(`The pacing tab and the Executive Summary disagree on the budget (${off.join('; ')}). The pacing tab drives this page; the summary table is shown as the sheet states it.`);
  }
  if (sm?.overview) {
    const tb = sm.overview.find(r => /^total budget/i.test(r.metric));
    if (tb?.plan !== null && tb?.plan !== undefined && allPaid) {
      const ok = close(allPaid.total, tb.plan);
      checks.push({
        name: 'Cohort budget matches the Executive Summary "Total Budget" plan', ok,
        detail: `${fmt$(allPaid.total)} vs ${fmt$(tb.plan)}`,
      });
      if (!ok) notes.push(`The Executive Summary's "Total Budget ($)" plan (${fmt$(tb.plan)}) differs from the pacing tab's cohort total (${fmt$(allPaid.total)}).`);
    }
  }

  return {
    docTitle,
    sheetId,
    pacingTab: tab,
    summaryTab: summary?.tab.title ?? null,
    totalBudget: allPaid?.total ?? null,
    weeks,
    allPaid,
    channels,
    byBucket: weeks.length ? bucketsFrom(weeks, channels) : null,
    summary: sm,
    checks,
    notes,
    fetchedAt: new Date().toISOString(),
  };
}

// ─── Cross-check: the cohort doc's raw "Ad Spend" tab ─────────────────────────
// The cohort doc also keeps a plain daily log — Date | Google | Bing | Facebook
// — that its Paid WoW tab is meant to roll up. On 2026-10-29 the Winter 2027
// doc's "Paid WoW Performance & Goals V2" reported $0 spend to date while this
// tab already carried $6,197 of Google spend keyed through 10/28, so the page
// sums this tab to the same date and says so when the two disagree. The Paid
// WoW figure stays the actual — it is what Pulse, /paid-aggregate and the
// channel tables quote — and this tab is never substituted for it.

const AD_SPEND_TAB = 'Ad Spend';

/** Google Sheets date serial → YYYY-MM-DD (day 0 = 1899-12-30). */
function serialToYmd(n: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

interface AdSpendSum {
  tab: string;
  byChannel: Partial<Record<BudgetChannel, number>>;
  total: number;
  lastKeyedDate: string | null;
}

async function readAdSpend(sheetId: string, through: string): Promise<AdSpendSum | null> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${AD_SPEND_TAB}'!A1:Z400`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const g = (res.data.values ?? []) as Grid;
    const hdr = g.findIndex(r => S(r?.[0]).toLowerCase() === 'date');
    if (hdr < 0) return null;
    const cols: { ch: BudgetChannel; c: number }[] = [];
    (g[hdr] ?? []).forEach((h, c) => {
      const ch = channelFor(S(h));
      if (ch && c > 0 && !cols.some(x => x.ch === ch)) cols.push({ ch, c });
    });
    if (!cols.length) return null;
    const byChannel: Partial<Record<BudgetChannel, number>> = {};
    let total = 0;
    let last: string | null = null;
    for (let r = hdr + 1; r < g.length; r++) {
      const serial = g[r]?.[0];
      if (typeof serial !== 'number') continue;
      const ymd = serialToYmd(serial);
      if (ymd > through) continue;
      let any = false;
      for (const { ch, c } of cols) {
        const v = N(g[r]?.[c]);
        if (v === null || v === 0) continue;
        byChannel[ch] = (byChannel[ch] ?? 0) + v;
        total += v;
        any = true;
      }
      if (any && (!last || ymd > last)) last = ymd;
    }
    return { tab: AD_SPEND_TAB, byChannel, total, lastKeyedDate: last };
  } catch {
    return null;
  }
}

// ─── Plan vs actual ───────────────────────────────────────────────────────────

/** Planned spend from the plan's first day through `through` (inclusive):
 *  whole weeks that have ended, plus the current week's daily plan × the days
 *  of it that have passed. */
function plannedThrough(weeks: PlanWeek[], weekly: number[], daily: number[], through: string): number {
  let total = 0;
  for (const w of weeks) {
    if (w.end <= through) { total += weekly[w.week - 1] ?? 0; continue; }
    if (w.start <= through) {
      const days = Math.round((parseYmd(through).getTime() - parseYmd(w.start).getTime()) / 86400000) + 1;
      total += (daily[w.week - 1] ?? 0) * days;
    }
  }
  return total;
}

function weekContaining(weeks: PlanWeek[], ymd: string): PlanWeek | null {
  return weeks.find(w => w.start <= ymd && ymd <= w.end) ?? null;
}

function ratio(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  const r = a / b;
  return isFinite(r) ? r : null;
}

export async function getBudgetPacing(): Promise<BudgetPacingResult> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return { ok: false, needsAccess: false, error: 'GOOGLE_SERVICE_ACCOUNT_KEY is not set', sheetId: null };
  }
  const now = nowET();
  const win: CohortWindow | null = getActiveCohort('wharton', now);
  if (!win) {
    return { ok: false, needsAccess: false, error: 'No Wharton cohort is open for enrollment today.', sheetId: null };
  }
  const planId = budgetPlanDocId(win.key);
  if (!planId) {
    return {
      ok: false, needsAccess: false, sheetId: null,
      error: `No budget workbook is wired for ${win.termLabel} (add it to BUDGET_PLAN_DOCS in src/lib/performance/budgetPlan.ts).`,
    };
  }

  let plan: BudgetPlan;
  try {
    plan = await readBudgetPlan(planId, win.opens);
  } catch (err: unknown) {
    const e = err as { code?: number; status?: number; message?: string };
    const code = e?.code ?? e?.status;
    return { ok: false, needsAccess: code === 403 || code === 404, error: e?.message ?? String(err), sheetId: planId };
  }

  const notes: string[] = [];

  // ── Alignment dates (needed before the actuals read for the Ad Spend cut-off) ──
  const asOf = todayET();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const throughDate = toYmd(yesterday);

  // ── Actuals: the active cohort doc's Paid WoW tab ──
  const active = getActiveCohortSheet('wharton', now);
  let paid: PaidWoW | null = null;
  let actuals: BudgetPacingData['actuals'] = null;
  if (!active) {
    notes.push(`${win.termLabel} has no cohort performance doc wired in src/lib/cohortSheets.ts yet, so actual spend is unavailable; the plan is shown alone.`);
  } else {
    try {
      const sheets = google.sheets({ version: 'v4', auth: getAuth() });
      const [meta, wow, ad] = await Promise.all([
        sheets.spreadsheets.get({ spreadsheetId: active.sheetId, fields: 'properties.title' }),
        readPaidWoW(active.sheetId, undefined, { unformatted: true }),
        readAdSpend(active.sheetId, throughDate),
      ]);
      paid = wow;
      if (!wow) {
        notes.push(`The cohort doc's "Paid WoW Performance & Goals" tab could not be read, so actual spend is unavailable.`);
      } else {
        const paidTotal = wow.totals?.spend ?? null;
        const agrees = ad === null || paidTotal === null
          ? true
          : close(ad.total, paidTotal, Math.max(100, Math.max(ad.total, paidTotal) * 0.01));
        actuals = {
          docTitle: meta.data.properties?.title ?? 'Cohort performance doc',
          sheetId: active.sheetId,
          tab: wow.source,
          totalSpend: paidTotal,
          weeksKeyed: wow.weeks.filter(w => (w.spend ?? 0) > 0).length,
          adSpend: ad ? { ...ad, agreesWithPaidWoW: agrees } : null,
        };
        if (ad && !agrees) {
          const parts = BUDGET_CHANNELS
            .filter(ch => (ad.byChannel[ch] ?? 0) !== 0)
            .map(ch => `${ch} ${fmt$(ad.byChannel[ch] ?? 0)}`);
          notes.push(
            `Actuals look unrolled-up: the cohort doc's “${wow.source}” tab reports ${fmt$(paidTotal ?? 0)} paid spend to date, ` +
            `but its “${ad.tab}” tab has ${fmt$(ad.total)} keyed through ${ad.lastKeyedDate ?? throughDate}` +
            `${parts.length ? ` (${parts.join(', ')})` : ''}. The Paid WoW tab is what this page and every other surface treat as ` +
            'actual, so the variance below is overstated until its roll-up is populated — confirm with Jon before reading it.',
          );
        }
      }
    } catch (err: unknown) {
      const e = err as { code?: number; status?: number; message?: string };
      const code = e?.code ?? e?.status;
      notes.push(
        code === 403 || code === 404
          ? `The service account can't open the ${win.termLabel} cohort doc, so actual spend is unavailable; the plan is shown alone.`
          : `Reading the cohort doc failed (${e?.message ?? String(err)}); the plan is shown alone.`,
      );
    }
  }

  // ── Alignment ──
  const cur = weekContaining(plan.weeks, asOf);
  const calendarWeek = getCohortWeek(win, now);
  const daysIntoWeek = cur && cur.start <= throughDate
    ? Math.round((parseYmd(throughDate).getTime() - parseYmd(cur.start).getTime()) / 86400000) + 1
    : 0;
  const lastWeek = plan.weeks[plan.weeks.length - 1];
  const beyond = lastWeek && asOf > lastWeek.end;
  if (cur && cur.week !== calendarWeek) {
    notes.push(
      `The workbook's week ${cur.week} (${cur.dateRange}) contains today, while the calendar's week-from-open ` +
      `count says week ${calendarWeek}; the sheets start week 2 on a Monday, so the two differ by a day at week boundaries. The sheet's own weeks are used.`,
    );
  }
  const alignmentNote =
    `Plan and actual are aligned by week-from-open as both sheets key it: week 1 is the partial week from the ` +
    `${win.termLabel} open (${plan.weeks[0]?.dateRange ?? '—'}), then Monday–Sunday weeks; the budget workbook and the cohort ` +
    `doc use the same week boundaries. "Planned to date" counts whole weeks that have ended plus the current week's daily plan × ` +
    `${daysIntoWeek} complete day${daysIntoWeek === 1 ? '' : 's'}, through ${throughDate}. Actual is the cohort doc's cohort-to-date figure as keyed.`;

  // ── Per-channel join ──
  const prior = (ch: BudgetChannel | 'Total'): number | null => {
    const rows = plan.summary?.overview ?? [];
    const row = ch === 'Total'
      ? rows.find(r => /^total budget/i.test(r.metric))
      : rows.find(r => channelFor(r.metric.replace(/\s*spend.*$/i, '')) === ch);
    return row?.priorActual ?? null;
  };
  const share = (ch: BudgetChannel): number | null => {
    const mix = plan.summary?.channelMix?.find(r => channelFor(r.channel) === ch);
    if (mix?.share !== null && mix?.share !== undefined) return mix.share;
    const p = plan.channels[ch];
    return p && plan.totalBudget ? p.total / plan.totalBudget : null;
  };
  const channels: BudgetPacingChannel[] = [];
  for (const ch of BUDGET_CHANNELS) {
    const p = plan.channels[ch];
    const a = paid?.channels.find(c => c.label === ch) ?? null;
    const plannedToDate = p ? plannedThrough(plan.weeks, p.weekly, p.daily, throughDate) : null;
    const plannedThroughWeek = p && cur ? sum(p.weekly.slice(0, cur.week)) : p && beyond ? p.total : p ? 0 : null;
    const actualToDate = a?.spend ?? null;
    const variance = plannedToDate !== null && actualToDate !== null ? actualToDate - plannedToDate : null;
    channels.push({
      channel: ch,
      budget: p?.total ?? null,
      share: share(ch),
      plannedToDate,
      plannedThroughWeek,
      actualToDate,
      docForecastToDate: a?.spendF ?? null,
      variance,
      variancePct: ratio(variance, plannedToDate),
      priorActual: prior(ch),
    });
  }
  // Total: the All Paid block when it reconciled, else the sum of the channels present.
  const present = channels.filter(c => c.budget !== null);
  const sumOrNull = (pick: (c: BudgetPacingChannel) => number | null): number | null => {
    const vals = present.map(pick);
    return vals.length && vals.every(v => v !== null) ? sum(vals as number[]) : null;
  };
  const totPlannedToDate = plan.allPaid
    ? plannedThrough(plan.weeks, plan.allPaid.weekly, plan.allPaid.daily, throughDate)
    : sumOrNull(c => c.plannedToDate);
  const totActual = paid?.totals?.spend ?? null;
  const totVariance = totPlannedToDate !== null && totActual !== null ? totActual - totPlannedToDate : null;
  channels.push({
    channel: 'Total',
    budget: plan.totalBudget ?? sumOrNull(c => c.budget),
    share: plan.totalBudget ? 1 : null,
    plannedToDate: totPlannedToDate,
    plannedThroughWeek: plan.allPaid
      ? (cur ? sum(plan.allPaid.weekly.slice(0, cur.week)) : beyond ? plan.allPaid.total : 0)
      : sumOrNull(c => c.plannedThroughWeek),
    actualToDate: totActual,
    docForecastToDate: paid?.totals?.spendF ?? null,
    variance: totVariance,
    variancePct: ratio(totVariance, totPlannedToDate),
    priorActual: prior('Total'),
  });
  if (plan.allPaid && present.length < 4) {
    notes.push('The cohort total is the All Paid block; with a channel block withheld, the channel rows no longer add up to it.');
  }

  // Actual-side consistency: channel "Total (All)" rows vs the all-paid total,
  // and the weekly series vs the all-paid total.
  if (paid?.totals?.spend !== null && paid?.totals?.spend !== undefined) {
    const chActual = sumOrNull(c => c.actualToDate);
    if (chActual !== null && !close(chActual, paid.totals.spend, Math.max(1, paid.totals.spend * 0.005))) {
      notes.push(`In the cohort doc, the channel blocks' to-date spend (${fmt$(chActual)}) doesn't match its all-paid Total (${fmt$(paid.totals.spend)}); each is shown as the doc states it.`);
    }
    const wkActual = sum(paid.weeks.map(w => w.spend ?? 0));
    if (paid.weeks.length && !close(wkActual, paid.totals.spend, Math.max(1, paid.totals.spend * 0.005))) {
      notes.push(`In the cohort doc, the weekly paid series (${fmt$(wkActual)}) doesn't sum to its all-paid Total (${fmt$(paid.totals.spend)}); the weekly bars and the to-date figure come from different rows.`);
    }
  }

  // ── Weekly series ──
  const weekly: BudgetPacingWeek[] = [];
  let cumP = 0, cumA = 0;
  let anyActual = false;
  for (const w of plan.weeks) {
    const byCh = {} as Record<BudgetChannel, number | null>;
    for (const ch of BUDGET_CHANNELS) byCh[ch] = plan.channels[ch]?.weekly[w.week - 1] ?? null;
    const planned = plan.allPaid
      ? plan.allPaid.weekly[w.week - 1]
      : present.length ? sum(BUDGET_CHANNELS.map(ch => byCh[ch] ?? 0)) : null;
    // The Paid WoW weekly rows carry the same "10/14-10/19" strings; match on
    // the text, and fall back to position only if the doc's text differs.
    const aw = paid?.weeks.find(x => x.dateRange.replace(/\s+/g, '') === w.dateRange.replace(/\s+/g, ''))
      ?? paid?.weeks[w.week - 1] ?? null;
    const actual = aw?.spend ?? null;
    if (planned !== null) cumP += planned;
    if (actual !== null) { cumA += actual; anyActual = true; }
    const status: BudgetPacingWeek['status'] = w.end < asOf ? 'past' : w.start > asOf ? 'future' : 'current';
    weekly.push({
      week: w.week, dateRange: w.dateRange, start: w.start, end: w.end, bucket: w.bucket,
      planned, plannedByChannel: byCh, actual,
      cumPlanned: planned !== null ? cumP : null,
      cumActual: anyActual && status !== 'future' ? cumA : null,
      status,
    });
  }
  if (paid && paid.weeks.length && paid.weeks[0].dateRange.replace(/\s+/g, '') !== (plan.weeks[0]?.dateRange ?? '').replace(/\s+/g, '')) {
    notes.push(`The cohort doc's weekly rows start at ${paid.weeks[0].dateRange} while the plan starts at ${plan.weeks[0]?.dateRange}; weeks are matched on their date-range text where it agrees and by position otherwise.`);
  }
  if (actuals && (actuals.totalSpend ?? 0) === 0 && (actuals.adSpend === null || actuals.adSpend.agreesWithPaidWoW)) {
    notes.push('The cohort doc has no paid spend keyed yet, so every actual reads $0 and the variance is the whole plan to date.');
  }
  const prefix = plan.summary?.priorLabel ? `${plan.summary.priorLabel} ` : 'Prior cohort ';
  notes.push(
    `${prefix}figures are the FULL-COHORT finals stated on the Executive Budget Summary, not a week-aligned ` +
    'comparison — they are the reference the plan was set against, not a pace benchmark.',
  );

  return {
    ok: true,
    data: {
      cohort: { key: win.key, label: win.label, termLabel: win.termLabel, opens: win.opens, extEnds: win.extEnds },
      asOf,
      alignment: {
        basis: 'week-from-open',
        currentWeek: cur?.week ?? (beyond ? lastWeek?.week ?? null : null),
        calendarWeek,
        throughDate,
        daysIntoWeek,
        note: alignmentNote,
      },
      plan,
      actuals,
      channels,
      weekly,
      notes,
      fetchedAt: new Date().toISOString(),
    },
  };
}

export { getServiceAccountEmail };
