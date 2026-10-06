// ─── Attribution model V2 — pure parsers (no I/O) ─────────────────────────────
//
// In Oct 2026 both cohort performance docs (Wharton and CBS) replaced their
// flat channel list ("PPC", "WSP Customers", "Offline/Direct", …) with a
// three-level hierarchy, defined on each doc's "Channel Definitions" tab:
//
//   Paid      Paid Search (Google, Bing) · Paid Social (Meta, LinkedIn) ·
//             Paid Other (Employer Test; Open AI at CBS) · Paid Affiliate ·
//             Sponsored Content
//   Non-Paid  Organic Search · AI Referral · Referral · Direct · Organic Social ·
//             Lifecycle (Cold Email, Email Other, Webinar) · Enrollment
//             (Consultation, Inbound) · Wall Street Prep (Banner, Leads,
//             Purchasers, EML, Financial Edge) · Offline (SamCart, Other)
//
// Attribution is original source (first touch). The V1 tabs ("Channel Tables",
// "Overall Performance Tables") were hidden and stopped updating — on 10/6/26
// V1 still read 691 Wharton enrollments against 903 actual — so nothing may
// fall back to them silently.
//
// Two V2 tabs are parsed here, shared by the /channels reader and the cohort
// pages' readChannelTable so the two can't interpret the model differently:
//   "Channel Tables V2"               — cohort × channel matrix (Leads,
//                                        Enrollments, Conversions sections)
//   "Overall Performance Tables - V2" — current-cohort economics incl. spend
//
// Every table row is one of (columns relative to the block's first column):
//   tier     "Paid | - | -"                        +0 names the tier
//   channel  "    | Paid Search |"                 sub-channels follow
//   leaf     "    | Organic Search | Organic Search"   its own sub-channel
//   single   "    | Paid Other | Employer Test"    exactly one named sub
//   sub      "    |             | Google"           +2 only
//   total    "    |             | Total"
// Imported blocks carry stray numbers in the tier column ("3", "2"), so only
// "Paid"/"Non-Paid" there is read as a tier.
//
// Rollups are rebuilt LEAF-UP: a channel with sub-channels is the sum of its
// subs, a tier is the sum of its channels, the total the sum of the tiers.
// Every subtotal the sheet states is then compared with the rebuilt one and
// any disagreement becomes a note — the sheet's figure is never silently
// preferred or silently dropped. (The CBS doc's Paid Social row, for one,
// leaves out the Employer Test leads its own LinkedIn cell folds in.)

import type {
  ChannelTier, ChannelSeriesRow, ChannelSubRow, ProgramChannelBlock, ProgramKey,
  ChannelEconRow, ChannelEconSub, ChannelEconFigures, ProgramEconBlock,
} from './channelTablesTypes';
import type { PaidWoW } from '@/lib/sheets';
import { resolveProgramKey, sumEcon, PROGRAM_DISPLAY } from './channelTablesTypes';

export type Grid = unknown[][];
const cell = (g: Grid, r: number, c: number): unknown => g[r]?.[c];

/** Unformatted cells arrive as numbers already; `#DIV/0!`, "-", "NM" and blanks → null. */
export function N(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === '' || s === '-' || s.startsWith('#')) return null;
  const n = parseFloat(s.replace(/[$,%]/g, ''));
  return isNaN(n) ? null : n;
}

export function S(v: unknown): string {
  return String(v ?? '').trim();
}

const isDash = (s: string) => s === '' || /^-+$/.test(s);

function tierOf(s: string): ChannelTier | null {
  const t = s.toLowerCase().replace(/\s+/g, '');
  if (t === 'paid') return 'paid';
  if (t === 'non-paid' || t === 'nonpaid') return 'nonpaid';
  return null;
}

const isTierHeader = (s: string) => /^paid\s*\/\s*non[-\s]?paid$/i.test(s);

/** The per-platform PPC slice — what the Paid WoW tab and the Paid Marketing
 *  Aggregate page report. */
export function isPpcChannel(channel: string): boolean {
  return /^paid\s+(search|social)$/i.test(channel.trim());
}

/** Join key for a label across sections and tabs, which spell the same row
 *  differently ("Consultation"/"Consulation", "Banner ads"/"Banner"/"Banner
 *  Ads", "FE"/"Financial Edge"). Used to VERIFY a positional join, never to
 *  make one. */
export function labelKey(s: string): string {
  const t = s.toLowerCase().replace(/[^a-z0-9&]+/g, ' ').replace(/\s+/g, ' ').trim();
  const aliases: Record<string, string> = {
    consulation: 'consultation',
    'banner ads': 'banner',
    'banner traffic seo': 'banner',
    fe: 'financial edge',
    'sam cart': 'samcart',
    'referral traffic': 'referral',
  };
  return aliases[t] ?? t;
}

// ─── Generic row-structure reader ─────────────────────────────────────────────

interface RawSub { name: string; row: number }
interface RawChannel {
  name: string;
  tier: ChannelTier;
  row: number;
  /** The channel row itself also names its one sub-channel. */
  single: boolean;
  subs: RawSub[];
}
interface RawTier { tier: ChannelTier; row: number }
export interface RawTable {
  tiers: RawTier[];
  channels: RawChannel[];
  totalRow: number;
}

/** Walk a table's rows from just under its header until its Total row. */
function readStructure(grid: Grid, col: number, firstRow: number): RawTable | { fail: string } {
  const tiers: RawTier[] = [];
  const channels: RawChannel[] = [];
  let tier: ChannelTier | null = null;
  for (let r = firstRow; r < Math.min(firstRow + 60, grid.length); r++) {
    const t0 = S(cell(grid, r, col));
    const t1 = S(cell(grid, r, col + 1));
    const t2 = S(cell(grid, r, col + 2));
    if (/^total$/i.test(t2) || (/^total$/i.test(t1) && isDash(t2))) {
      if (!channels.length) return { fail: 'Total row reached before any channel' };
      return { tiers, channels, totalRow: r };
    }
    const tr = tierOf(t0);
    if (tr) { tier = tr; tiers.push({ tier: tr, row: r }); continue; }
    if (!t0 && !t1 && !t2) return { fail: `blank row ${r + 1} before the Total row` };
    if (!tier) return { fail: `row ${r + 1} ("${t1 || t2}") precedes any Paid/Non-Paid tier row` };
    if (!isDash(t1)) {
      const single = !isDash(t2) && labelKey(t2) !== labelKey(t1);
      channels.push({
        name: t1, tier, row: r, single,
        subs: single ? [{ name: t2, row: r }] : [],
      });
      continue;
    }
    if (!isDash(t2)) {
      const parent = channels[channels.length - 1];
      if (!parent || parent.tier !== tier || parent.single) {
        return { fail: `sub-channel "${t2}" (row ${r + 1}) has no parent channel` };
      }
      parent.subs.push({ name: t2, row: r });
      continue;
    }
  }
  return { fail: 'no Total row found' };
}

/** Two sections / tabs must list the same channels and sub-channels in the
 *  same order — the join between them is positional, and this is its check. */
function sameShape(a: RawTable, b: RawTable): string | null {
  if (a.channels.length !== b.channels.length) {
    return `${a.channels.length} channels vs ${b.channels.length}`;
  }
  for (let i = 0; i < a.channels.length; i++) {
    const x = a.channels[i];
    const y = b.channels[i];
    if (labelKey(x.name) !== labelKey(y.name) || x.tier !== y.tier) {
      return `channel ${i + 1} is "${x.name}" vs "${y.name}"`;
    }
    if (x.subs.length !== y.subs.length) {
      return `"${x.name}" has ${x.subs.length} sub-channels vs ${y.subs.length}`;
    }
    for (let j = 0; j < x.subs.length; j++) {
      if (labelKey(x.subs[j].name) !== labelKey(y.subs[j].name)) {
        return `"${x.name}" sub-channel ${j + 1} is "${x.subs[j].name}" vs "${y.subs[j].name}"`;
      }
    }
  }
  return null;
}

const fmtN = (n: number) => Math.round(n).toLocaleString('en-US');
const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** Sum aligned series. A column no part has data for stays null. */
function sumCols(parts: Array<Array<number | null>>, n: number): Array<number | null> {
  return Array.from({ length: n }, (_, i) => {
    let any = false;
    let t = 0;
    for (const p of parts) if (p[i] !== null && p[i] !== undefined) { any = true; t += p[i]!; }
    return any ? t : null;
  });
}

// ─── "Channel Tables V2" matrix ───────────────────────────────────────────────

export interface MatrixParse {
  programs: ProgramChannelBlock[];
  notes: string[];
  fails: string[];
  /** The sheet's own channel-row values for channels with sub-channels, keyed
   *  `${program}|${labelKey(channel)}`. Compared with the leaf-up sums only
   *  after any correction has run — see channelSubtotalNotes. */
  sheetChannels: Map<string, { leads: Array<number | null>; enrollments: Array<number | null> }>;
}

interface SectionHeader { row: number; label: string }

/** Every "Paid/Non-Paid" header cell, grouped by the column it sits in — one
 *  column per program block. */
function findBlockColumns(grid: Grid): Map<number, SectionHeader[]> {
  const byCol = new Map<number, SectionHeader[]>();
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      if (!isTierHeader(S(row[c]))) continue;
      // The section label sits directly above the header ("Leads").
      const label = S(cell(grid, r - 1, c)).toLowerCase();
      const list = byCol.get(c) ?? [];
      list.push({ row: r, label });
      byCol.set(c, list);
    }
  }
  return byCol;
}

/** The block's banner: the nearest non-empty cell above its first section
 *  label that isn't itself a section label. CBS's single block has none. */
function bannerFor(grid: Grid, col: number, firstHeaderRow: number): string | null {
  for (let r = firstHeaderRow - 2; r >= 0; r--) {
    const t = S(cell(grid, r, col));
    if (!t) continue;
    if (/^(leads|enrollments?|conversions?)$/i.test(t)) continue;
    return t;
  }
  return null;
}

function readCohorts(grid: Grid, col: number, hdr: number): string[] {
  const out: string[] = [];
  for (let c = col + 3; c < col + 12; c++) {
    const l = S(cell(grid, hdr, c));
    if (!l) break;
    out.push(l);
  }
  return out;
}

const valuesAt = (grid: Grid, row: number, col: number, n: number) =>
  Array.from({ length: n }, (_, i) => N(cell(grid, row, col + 3 + i)));

export function parseMatrixV2(
  grid: Grid,
  opts: { aliases?: Record<string, ProgramKey>; singleProgram?: ProgramKey },
): MatrixParse {
  const programs: ProgramChannelBlock[] = [];
  const notes: string[] = [];
  const fails: string[] = [];
  const sheetChannels: MatrixParse['sheetChannels'] = new Map();
  const blocks = findBlockColumns(grid);

  for (const [col, headers] of [...blocks.entries()].sort((a, b) => a[0] - b[0])) {
    const banner = bannerFor(grid, col, headers[0].row);
    const program = banner
      ? resolveProgramKey(banner, opts.aliases)
      : blocks.size === 1 ? opts.singleProgram ?? null : null;
    const name = banner ?? (program ? PROGRAM_DISPLAY[program] : `(unbannered, column ${col + 1})`);
    if (!program) { fails.push(`"${name}": not a known program banner`); continue; }

    // Sections stack Leads → Enrollments → Conversions. Any label present must
    // agree with that order — a contradiction fails the block rather than
    // misfiling a section.
    const expected = [/^leads$/, /^enrollments?$/, /^conversions?$/];
    const bad = headers.slice(0, 3).find((h, i) => h.label && !expected[i].test(h.label));
    if (headers.length < 2 || bad) {
      fails.push(`"${name}": Leads/Enrollments sections not found in the expected order`);
      continue;
    }
    const [lh, eh] = headers;
    const cohorts = readCohorts(grid, col, lh.row);
    const eCohorts = readCohorts(grid, col, eh.row);
    if (!cohorts.length || cohorts.join('|') !== eCohorts.join('|')) {
      fails.push(`"${name}": Leads cohorts (${cohorts.join(', ')}) don't match ` +
        `Enrollments cohorts (${eCohorts.join(', ')})`);
      continue;
    }
    const lStruct = readStructure(grid, col, lh.row + 1);
    const eStruct = readStructure(grid, col, eh.row + 1);
    if ('fail' in lStruct) { fails.push(`"${name}" Leads: ${lStruct.fail}`); continue; }
    if ('fail' in eStruct) { fails.push(`"${name}" Enrollments: ${eStruct.fail}`); continue; }
    const shape = sameShape(lStruct, eStruct);
    if (shape) { fails.push(`"${name}": Leads and Enrollments sections differ — ${shape}`); continue; }

    const n = cohorts.length;
    const lTot = valuesAt(grid, lStruct.totalRow, col, n);
    const eTot = valuesAt(grid, eStruct.totalRow, col, n);

    // Column presence. A blank Total is no data; a Total of 0 leads AND 0
    // enrollments is a program that didn't run that cohort (RDI before Spring
    // 2026 carries literal zeros). Both stay null so absence never reads as 0.
    const present = lTot.map((l, i) => l !== null && !(l === 0 && (eTot[i] ?? 0) === 0));
    // Leads exactly 0 with enrollments > 0 is the upstream gap seen 9/15/26:
    // the program docs stopped filling Leads, which zeroes this column. Keep
    // the block, null that column's leads, and say so.
    const leadGap = lTot.map((l, i) => l === 0 && (eTot[i] ?? 0) > 0);
    for (let i = 0; i < n; i++) {
      if (lTot[i] !== null && eTot[i] !== null && lTot[i]! > 0 && eTot[i]! > lTot[i]!) {
        notes.push(`${name} · ${cohorts[i]}: the sheet shows more enrollments (${fmtN(eTot[i]!)}) ` +
          `than leads (${fmtN(lTot[i]!)}).`);
      }
    }
    const leadsCol = (row: number) => valuesAt(grid, row, col, n)
      .map((v, i) => (!present[i] || leadGap[i] ? null : v ?? 0));
    const enrollCol = (row: number) => valuesAt(grid, row, col, n)
      .map((v, i) => (present[i] || leadGap[i] ? v ?? 0 : null));

    const rows: ChannelSeriesRow[] = lStruct.channels.map((lc, k) => {
      const ec = eStruct.channels[k];
      const subs: ChannelSubRow[] = lc.subs.map((s, j) => ({
        name: s.name,
        leads: leadsCol(s.row),
        enrollments: enrollCol(ec.subs[j].row),
        inCohort: null,
      }));
      const sheetLeads = leadsCol(lc.row);
      const sheetEnr = enrollCol(ec.row);
      const leads = subs.length ? sumCols(subs.map(s => s.leads), n) : sheetLeads;
      const enrollments = subs.length ? sumCols(subs.map(s => s.enrollments), n) : sheetEnr;
      if (subs.length > 1) {
        sheetChannels.set(`${program}|${labelKey(lc.name)}`, { leads: sheetLeads, enrollments: sheetEnr });
      }
      return {
        channel: lc.name,
        tier: lc.tier,
        paid: lc.tier === 'paid',
        ppc: isPpcChannel(lc.name),
        leads,
        enrollments,
        inCohort: null,
        subs,
      };
    });

    // The sheet's own tier and Total rows, checked against the rebuild.
    for (const [what, struct, sheetCol] of [
      ['leads', lStruct, leadsCol], ['enrollments', eStruct, enrollCol],
    ] as const) {
      const metric = what === 'leads' ? 'leads' : 'enrollments';
      for (const t of struct.tiers) {
        const sheet = sheetCol(t.row);
        const rebuilt = sumCols(rows.filter(r => r.tier === t.tier).map(r => r[metric]), n);
        for (let i = 0; i < n; i++) {
          if (sheet[i] !== null && rebuilt[i] !== null && Math.round(sheet[i]!) !== Math.round(rebuilt[i]!)) {
            notes.push(`${name} · ${cohorts[i]} · ${t.tier === 'paid' ? 'Paid' : 'Non-Paid'} ${what}: ` +
              `the sheet's tier row says ${fmtN(sheet[i]!)}; its channels sum to ${fmtN(rebuilt[i]!)}.`);
          }
        }
      }
      const sheetTotal = sheetCol(struct.totalRow);
      const rebuilt = sumCols(rows.map(r => r[metric]), n);
      for (let i = 0; i < n; i++) {
        if (sheetTotal[i] !== null && rebuilt[i] !== null && Math.round(sheetTotal[i]!) !== Math.round(rebuilt[i]!)) {
          notes.push(`${name} · ${cohorts[i]} · Total ${what}: the sheet says ` +
            `${fmtN(sheetTotal[i]!)}; its channels sum to ${fmtN(rebuilt[i]!)}.`);
        }
      }
    }

    const gapCohorts = cohorts.filter((_, i) => leadGap[i]);
    if (gapCohorts.length) {
      notes.push(`${name}: leads are missing at source for ${gapCohorts.join(', ')} — the sheet ` +
        `reports enrollments over an empty Leads column. Leads and CVR show "—" there; ` +
        `enrollments are unaffected.`);
    }

    programs.push({
      program,
      displayName: name,
      cohorts,
      rows,
      totals: {
        leads: lTot.map((v, i) => (present[i] && !leadGap[i] ? v : null)),
        enrollments: eTot.map((v, i) => (present[i] || leadGap[i] ? v : null)),
      },
      hasInCohort: false,
    });
  }
  return { programs, notes, fails, sheetChannels };
}

/** A channel row in the sheet that doesn't equal its own sub-channels. Run
 *  after reconcileCurrent, so a row the correction brought back in line with
 *  its subs (CBS Paid Social once Employer Test leaves LinkedIn) isn't
 *  reported. */
export function channelSubtotalNotes(parse: MatrixParse, corrected = new Set<string>()): string[] {
  const notes: string[] = [];
  for (const block of parse.programs) {
    for (const r of block.rows) {
      const key = `${block.program}|${labelKey(r.channel)}`;
      const sheet = parse.sheetChannels.get(key);
      // A channel a correction touched is explained by that correction's note.
      if (!sheet || corrected.has(key)) continue;
      for (const [what, sv, rv] of [
        ['leads', sheet.leads, r.leads], ['enrollments', sheet.enrollments, r.enrollments],
      ] as const) {
        sv.forEach((v, i) => {
          if (v === null || rv[i] === null || Math.round(v) === Math.round(rv[i]!)) return;
          notes.push(`${block.displayName} · ${block.cohorts[i]} · ${r.channel} ${what}: the sheet's ` +
            `row says ${fmtN(v)} but its sub-channels (${r.subs.map(s => s.name).join(' + ')}) sum to ` +
            `${fmtN(rv[i]!)}. Shown here as the sum, so every rollup ties out.`);
        });
      }
    }
  }
  return notes;
}

// ─── "Overall Performance Tables - V2" economics ──────────────────────────────

export interface EconParse {
  blocks: ProgramEconBlock[];
  notes: string[];
  /** Revenue per enrollment the tab's ROAS cells use ("AOV" cell), if stated. */
  aov: number | null;
}

/** Per-platform spend + leads from the doc's Paid WoW tab, by program then by
 *  labelKey(platform). The cohort-wide figures sit under the totals key. This
 *  is the independent source that tells a correct spend cell from a copied
 *  one — and, where its leads match the economics row, replaces the copy. */
export type PlatformFigures = Map<ProgramKey, Map<string, { spend: number | null; leads: number | null }>>;

export function platformFiguresFromPaidWoW(
  paid: PaidWoW | null, totalsKey: ProgramKey, aliases?: Record<string, ProgramKey>,
): PlatformFigures | undefined {
  if (!paid?.channels.length) return undefined;
  const out: PlatformFigures = new Map();
  const put = (k: ProgramKey, platform: string, spend: number | null, leads: number | null) => {
    const m = out.get(k) ?? new Map();
    m.set(labelKey(platform), { spend, leads });
    out.set(k, m);
  };
  for (const c of paid.channels) put(totalsKey, c.label, c.spend, c.leads);
  for (const [platform, rows] of Object.entries(paid.channelPrograms ?? {})) {
    for (const r of rows) {
      const k = resolveProgramKey(r.label, aliases);
      if (k && k !== totalsKey) put(k, platform, r.spend, r.leads);
    }
  }
  return out;
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.01);

export function parseEconV2(
  grid: Grid,
  opts: {
    aliases?: Record<string, ProgramKey>;
    /** The block whose figures are the doc's cohort-wide totals ('overall' at
     *  Wharton, 'ai' at CBS) — the one comparable to the Paid WoW tab. */
    totalsKey: ProgramKey;
    platform?: PlatformFigures;
    tabName: string;
  },
): EconParse {
  const blocks: ProgramEconBlock[] = [];
  const notes: string[] = [];
  let aov: number | null = null;

  // "AOV | 4700" sits beside the first header row.
  for (let r = 0; r < Math.min(grid.length, 6) && aov === null; r++) {
    const row = grid[r] ?? [];
    for (let c = 0; c < row.length - 1; c++) {
      if (/^aov$/i.test(S(row[c]))) { aov = N(row[c + 1]); break; }
    }
  }

  // Raw parse first; spend checks need every block before any is finalised.
  interface Raw {
    program: ProgramKey; displayName: string; struct: RawTable;
    at: (row: number) => ChannelEconFigures; sheetTotal: ChannelEconFigures;
  }
  const raws: Raw[] = [];
  for (let r = 1; r < grid.length; r++) {
    if (!isTierHeader(S(cell(grid, r, 0)))) continue;
    const banner = S(cell(grid, r - 1, 0));
    const name = banner.replace(/\bperformance\b/i, '').trim() || 'Overall';
    const program = resolveProgramKey(name, opts.aliases);
    if (!program) {
      notes.push(`${opts.tabName}: a block bannered "${banner}" isn't a known program and was skipped.`);
      continue;
    }
    const header = (grid[r] ?? []).map(c => S(c).toLowerCase());
    const col = (re: RegExp) => header.findIndex(h => re.test(h));
    const c = { enrolls: col(/^enrolls?$/), leads: col(/^leads$/), spend: col(/spend/) };
    if (c.enrolls < 0 || c.leads < 0) {
      notes.push(`${opts.tabName} · ${name}: no Enrolls/Leads header — block skipped.`);
      continue;
    }
    const struct = readStructure(grid, 0, r + 1);
    if ('fail' in struct) {
      notes.push(`${opts.tabName} · ${name}: ${struct.fail} — block skipped.`);
      continue;
    }
    const tierRows = new Set(struct.tiers.map(t => t.row));
    const nonPaidFrom = struct.tiers.find(t => t.tier === 'nonpaid')?.row ?? Infinity;
    const at = (row: number): ChannelEconFigures => ({
      enrolls: N(cell(grid, row, c.enrolls)),
      leads: N(cell(grid, row, c.leads)),
      // Non-paid rows record no spend; their blank is "none", not unknown.
      spend: c.spend >= 0 && (row < nonPaidFrom || tierRows.has(row) || row === struct.totalRow)
        ? N(cell(grid, row, c.spend)) : null,
      spendWithheld: false,
    });
    raws.push({ program, displayName: banner || name, struct, at, sheetTotal: at(struct.totalRow) });
  }

  // ── Copied spend: two sibling sub-channels reporting the identical figure.
  // Seen 10/6/26 in every block of both docs: LinkedIn's Direct Spend repeats
  // Meta's ($221,521 at Wharton, where Paid WoW has LinkedIn at $65,340). The
  // Paid WoW tab decides which sibling is the copy: whichever doesn't match
  // its own platform total in the cohort-wide block. Without that evidence
  // both are withheld — guessing which is right would be worse than either.
  interface DupPair { a: string; b: string; value: number; cohortWide: boolean }
  const pairs = new Map<string, DupPair>(); // keyed by the two labelKeys, sorted
  for (const raw of raws) {
    for (const ch of raw.struct.channels) {
      const subs = ch.subs.map(s => ({ name: s.name, v: raw.at(s.row).spend }));
      for (let i = 0; i < subs.length; i++) {
        for (let j = i + 1; j < subs.length; j++) {
          const x = subs[i].v;
          const y = subs[j].v;
          if (x === null || y === null || x <= 0 || Math.abs(x - y) >= 0.005) continue;
          const key = [labelKey(subs[i].name), labelKey(subs[j].name)].sort().join('|');
          const cohortWide = raw.program === opts.totalsKey;
          // Prefer the cohort-wide block's figure — it's the one Paid WoW can vouch for.
          if (!pairs.has(key) || (cohortWide && !pairs.get(key)!.cohortWide)) {
            pairs.set(key, { a: subs[i].name, b: subs[j].name, value: x, cohortWide });
          }
        }
      }
    }
  }
  const cohortWide = opts.platform?.get(opts.totalsKey);
  const copied = new Set<string>(); // labelKeys whose spend cells are a copy
  interface Copy { bad: string; good: string; value: number; badWow: number | null }
  const copies: Copy[] = [];
  for (const p of pairs.values()) {
    const wowA = cohortWide?.get(labelKey(p.a))?.spend ?? undefined;
    const wowB = cohortWide?.get(labelKey(p.b))?.spend ?? undefined;
    const okA = p.cohortWide && wowA !== undefined && close(p.value, wowA);
    const okB = p.cohortWide && wowB !== undefined && close(p.value, wowB);
    if (okA !== okB) {
      const [good, bad, badWow] = okA ? [p.a, p.b, wowB] : [p.b, p.a, wowA];
      copied.add(labelKey(bad));
      copies.push({ bad, good, value: p.value, badWow: badWow ?? null });
    } else {
      copied.add(labelKey(p.a));
      copied.add(labelKey(p.b));
      notes.push(`${p.a} and ${p.b} spend withheld: ${opts.tabName} reports the identical figure ` +
        `(${fmt$(p.value)}) for both, so at least one is a copy, and the Paid WoW tab can't say ` +
        `which. Their parent channel, the Paid tier and the Total are withheld with them.`);
    }
  }

  // A copied cell is replaced with the Paid WoW figure for the same program
  // and platform ONLY when the two agree on that row's leads — the proof
  // they're the same line. Otherwise it stays withheld.
  const corrected = new Map<string, string[]>(); // labelKey → blocks corrected
  const stillWithheld = new Map<string, string[]>();
  const fixSpend = (raw: { program: ProgramKey; displayName: string }, name: string, f: ChannelEconFigures) => {
    const k = labelKey(name);
    if (!copied.has(k) || f.spend === null || f.spend <= 0) return { spend: f.spend, withheld: false, fixed: false };
    const w = opts.platform?.get(raw.program)?.get(k);
    if (w && w.spend !== null && w.leads !== null && f.leads !== null && Math.round(w.leads) === Math.round(f.leads)) {
      corrected.set(k, [...(corrected.get(k) ?? []), raw.displayName]);
      return { spend: w.spend, withheld: false, fixed: true };
    }
    stillWithheld.set(k, [...(stillWithheld.get(k) ?? []), raw.displayName]);
    return { spend: null, withheld: true, fixed: false };
  };

  // ── Build blocks leaf-up.
  for (const raw of raws) {
    const rows: ChannelEconRow[] = raw.struct.channels.map(ch => {
      const subs: ChannelEconSub[] = ch.subs.map(s => {
        const f = raw.at(s.row);
        const fx = fixSpend(raw, s.name, f);
        return {
          name: s.name, ...f, spend: fx.spend, spendWithheld: fx.withheld,
          ...(fx.fixed ? { spendCorrected: true } : {}),
        };
      });
      const own = raw.at(ch.row);
      const figures = subs.length > 1 ? sumEcon(subs) : subs.length === 1
        ? { ...subs[0] } : own;
      if (subs.length > 1) {
        for (const k of ['leads', 'enrolls'] as const) {
          if (own[k] !== null && figures[k] !== null && Math.round(own[k]!) !== Math.round(figures[k]!)) {
            notes.push(`${opts.tabName} · ${raw.displayName} · ${ch.name} ${k}: the sheet's row says ` +
              `${fmtN(own[k]!)}; its sub-channels sum to ${fmtN(figures[k]!)}.`);
          }
        }
      }
      return {
        channel: ch.name,
        tier: ch.tier,
        paid: ch.tier === 'paid',
        ppc: isPpcChannel(ch.name),
        enrolls: figures.enrolls,
        leads: figures.leads,
        spend: figures.spend,
        spendWithheld: figures.spendWithheld,
        ...(figures.spendCorrected ? { spendCorrected: true } : {}),
        subs: subs.length === 1 && labelKey(subs[0].name) === labelKey(ch.name) ? [] : subs,
      };
    });
    const total = sumEcon(rows);
    for (const k of ['leads', 'enrolls'] as const) {
      const s = raw.sheetTotal[k];
      if (s !== null && total[k] !== null && Math.round(s) !== Math.round(total[k]!)) {
        notes.push(`${opts.tabName} · ${raw.displayName} · Total ${k}: the sheet says ${fmtN(s)}; ` +
          `its channels sum to ${fmtN(total[k]!)}.`);
      }
    }
    blocks.push({ program: raw.program, displayName: raw.displayName, rows, total });
  }

  for (const c of copies) {
    const k = labelKey(c.bad);
    const fixedIn = corrected.get(k) ?? [];
    const heldIn = stillWithheld.get(k) ?? [];
    const head = `${opts.tabName} repeats ${c.good}'s spend on the ${c.bad} row ` +
      `(${fmt$(c.value)} cohort-wide)`;
    if (fixedIn.length && !heldIn.length) {
      notes.push(`${c.bad} spend corrected: ${head}. Replaced with the Paid WoW tab's ${c.bad} spend ` +
        `for each program${c.badWow !== null ? ` (${fmt$(c.badWow)} cohort-wide)` : ''} — its ${c.bad} ` +
        `leads match this tab's row for row, so it is the same line. Corrected cells are marked †.`);
    } else if (fixedIn.length) {
      notes.push(`${c.bad} spend corrected where possible: ${head}. Replaced with the Paid WoW tab's ` +
        `figure for ${fixedIn.join(', ')} (leads match row for row); withheld for ${heldIn.join(', ')}, ` +
        `where they don't — with the parent channel, Paid tier and Total spend there.`);
    } else {
      notes.push(`${c.bad} spend withheld: ${head}` +
        (c.badWow !== null ? `; the Paid WoW tab has ${c.bad} at ${fmt$(c.badWow)}` : '') +
        `, but its leads don't line up with this tab's, so it can't be swapped in. The parent ` +
        `channel, the Paid tier and the Total include the copy, so their spend, CPL and CPE are ` +
        `withheld too. Leads and enrollments are unaffected.`);
    }
  }

  // ── Program-attributed vs total platform spend (cohort-wide block only).
  // The economics tab only carries spend attributed to a program, so brand /
  // generic search sits in Paid WoW but in none of these blocks.
  const tb = blocks.find(b => b.program === opts.totalsKey);
  if (tb && cohortWide) {
    const gaps: string[] = [];
    let gapTotal = 0;
    for (const row of tb.rows) {
      for (const s of row.subs.length ? row.subs : [{ name: row.channel, ...row }]) {
        const wow = cohortWide.get(labelKey(s.name))?.spend ?? undefined;
        if (wow === undefined || s.spend === null || s.spendWithheld) continue;
        const d = wow - s.spend;
        if (Math.abs(d) > Math.max(500, wow * 0.01)) {
          gaps.push(`${s.name} ${fmt$(s.spend)} here vs ${fmt$(wow)}`);
          gapTotal += d;
        }
      }
    }
    if (gaps.length) {
      notes.push(`Spend in ${opts.tabName} is program-attributed only, so it runs ` +
        `${gapTotal > 0 ? 'below' : 'above'} the Paid WoW tab: ${gaps.join('; ')} ` +
        `(${fmt$(Math.abs(gapTotal))} net). Brand/generic spend not tagged to a program is in Paid ` +
        `WoW but in none of these tables.`);
    }
  }

  return { blocks, notes, aov };
}

// ─── Cross-tab check: matrix current column vs economics tab ──────────────────
//
// The matrix's Current Cohort column is formula-driven off the economics tab,
// so the two should agree row for row. Where they don't, the matrix formula is
// wiring rows together differently — e.g. CBS's LinkedIn cell is `F9+F12`
// (LinkedIn + Employer Test) while its Paid Other row takes Open AI alone.
//
// When ONE matrix leaf carries the whole gap and that gap equals — in leads
// AND enrollments — exactly one economics row the matrix doesn't list, the
// matrix is corrected: the row is moved out of the leaf it was folded into and
// placed under its economics parent, current column only. The move is kept
// only if every row of the two tabs then agrees; otherwise it is undone and
// the disagreement is reported as found.

interface Leaf { label: string; leads: Array<number | null>; enrollments: Array<number | null> }

function econLeaves(e: ProgramEconBlock) {
  const out = new Map<string, ChannelEconFigures & { name: string; parent: string }>();
  for (const r of e.rows) {
    out.set(labelKey(r.channel), { name: r.channel, parent: r.channel, ...r });
    for (const s of r.subs) out.set(labelKey(s.name), { ...s, parent: r.channel });
  }
  return out;
}

function currentDiffs(block: ProgramChannelBlock, e: ProgramEconBlock) {
  const cur = block.cohorts.length - 1;
  const ex = econLeaves(e);
  const diffs: Array<{ label: string; leaf: boolean; dl: number; de: number; ml: number | null; me: number | null; el: number | null; ee: number | null }> = [];
  const check = (x: Leaf, leaf: boolean) => {
    const f = ex.get(labelKey(x.label));
    if (!f) return;
    const ml = x.leads[cur];
    const me = x.enrollments[cur];
    const dl = ml !== null && f.leads !== null ? Math.round(ml - f.leads) : 0;
    const de = me !== null && f.enrolls !== null ? Math.round(me - f.enrolls) : 0;
    if (dl || de) diffs.push({ label: x.label, leaf, dl, de, ml, me, el: f.leads, ee: f.enrolls });
  };
  for (const r of block.rows) {
    check({ label: r.channel, leads: r.leads, enrollments: r.enrollments }, r.subs.length === 0);
    for (const s of r.subs) check({ label: s.name, leads: s.leads, enrollments: s.enrollments }, true);
  }
  return diffs;
}

function recomputeChannel(r: ChannelSeriesRow, n: number) {
  if (!r.subs.length) return;
  r.leads = sumCols(r.subs.map(s => s.leads), n);
  r.enrollments = sumCols(r.subs.map(s => s.enrollments), n);
  if (r.inCohort) r.inCohort = sumCols(r.subs.map(s => s.inCohort ?? r.subs.map(() => null)), n);
}

/** Try the single-fold correction described above on one block. Returns a
 *  note and the channels it touched when applied, null when it wasn't (block
 *  left untouched). */
function tryUnfold(
  block: ProgramChannelBlock, e: ProgramEconBlock, econTab: string, matrixTab: string,
): { note: string; touched: string[] } | null {
  const diffs = currentDiffs(block, e);
  const leafDiffs = diffs.filter(d => d.leaf);
  if (leafDiffs.length < 1) return null;
  const cur = block.cohorts.length - 1;
  const n = block.cohorts.length;
  const ex = econLeaves(e);
  const matrixKeys = new Set(block.rows.flatMap(r => [labelKey(r.channel), ...r.subs.map(s => labelKey(s.name))]));
  // The one matrix leaf that is HIGHER than the economics tab, and the one
  // economics row missing from the matrix whose figures equal that excess.
  const over = leafDiffs.filter(d => d.dl > 0 || d.de > 0);
  if (over.length !== 1 || over[0].dl < 0 || over[0].de < 0) return null;
  const { dl, de } = over[0];
  const candidates = [...ex.values()].filter(x =>
    !matrixKeys.has(labelKey(x.name)) && x.name !== x.parent &&
    Math.round(x.leads ?? -1) === dl && Math.round(x.enrolls ?? -1) === de);
  if (candidates.length !== 1) return null;
  const moved = candidates[0];
  const target = block.rows.find(r => labelKey(r.channel) === labelKey(moved.parent));
  const from = block.rows.find(r => r.subs.some(s => labelKey(s.name) === labelKey(over[0].label)))
    ?? block.rows.find(r => labelKey(r.channel) === labelKey(over[0].label));
  if (!target || !from) return null;

  // Snapshot for rollback.
  const snapshot = JSON.parse(JSON.stringify(block.rows)) as ChannelSeriesRow[];
  const fromLeaf: { leads: Array<number | null>; enrollments: Array<number | null>; inCohort: Array<number | null> | null } =
    from.subs.find(s => labelKey(s.name) === labelKey(over[0].label)) ?? from;
  fromLeaf.leads = fromLeaf.leads.map((v, i) => (i === cur && v !== null ? v - dl : v));
  fromLeaf.enrollments = fromLeaf.enrollments.map((v, i) => (i === cur && v !== null ? v - de : v));
  // In-cohort: if the folded-in leaf now has more in-cohort enrollments than
  // enrollments, the excess belonged to the moved row; otherwise the moved
  // row's in-cohort count is unknown (null), never assumed.
  let movedIn: number | null = null;
  if (fromLeaf.inCohort && fromLeaf.inCohort[cur] !== null && fromLeaf.enrollments[cur] !== null) {
    const excess = fromLeaf.inCohort[cur]! - fromLeaf.enrollments[cur]!;
    if (excess > 0) {
      movedIn = excess;
      fromLeaf.inCohort = fromLeaf.inCohort.map((v, i) => (i === cur ? v! - excess : v));
    }
  }
  const presentCol = (i: number) => block.totals.enrollments[i] !== null;
  if (!target.subs.length) {
    // The parent was its own leaf — give it a sub for what it already held.
    target.subs.push({ name: target.channel, leads: [...target.leads], enrollments: [...target.enrollments], inCohort: target.inCohort ? [...target.inCohort] : null });
  }
  target.subs.push({
    name: moved.name,
    leads: block.cohorts.map((_, i) => (i === cur ? moved.leads : presentCol(i) ? 0 : null)),
    enrollments: block.cohorts.map((_, i) => (i === cur ? moved.enrolls : presentCol(i) ? 0 : null)),
    inCohort: block.hasInCohort ? block.cohorts.map((_, i) => (i === cur ? movedIn : presentCol(i) ? 0 : null)) : null,
  });
  recomputeChannel(target, n);
  recomputeChannel(from, n);

  if (currentDiffs(block, e).length) {
    block.rows = snapshot;
    return null;
  }
  return {
    note: `${block.displayName} · ${block.cohorts[cur]}: corrected — ${matrixTab} counts ` +
      `${moved.name} (${fmtN(dl)} leads, ${fmtN(de)} enrollments) inside ${over[0].label} (and ` +
      `partly in ${from.channel}'s own row), while ${econTab} lists it under ${moved.parent}. Moved ` +
      `here to ${moved.parent} · ${moved.name}, after which every row of the two tabs agrees. ` +
      `${over[0].label} now reads ${fmtN(fromLeaf.leads[cur] ?? 0)} leads; prior cohorts are ` +
      `unchanged (${moved.name} didn't run then).`,
    touched: [from.channel, target.channel].map(c => `${block.program}|${labelKey(c)}`),
  };
}

export function reconcileCurrent(
  programs: ProgramChannelBlock[], econ: ProgramEconBlock[], econTab: string, matrixTab: string,
): { notes: string[]; corrected: Set<string> } {
  const notes: string[] = [];
  const corrected = new Set<string>();
  for (const block of programs) {
    const e = econ.find(x => x.program === block.program);
    if (!e) continue;
    const fixed = tryUnfold(block, e, econTab, matrixTab);
    if (fixed) {
      notes.push(fixed.note);
      fixed.touched.forEach(t => corrected.add(t));
      continue;
    }
    const diffs = currentDiffs(block, e);
    if (!diffs.length) continue;
    const cur = block.cohorts.length - 1;
    const parts = diffs.flatMap(d => [
      ...(d.dl ? [`${d.label} leads ${fmtN(d.ml!)} vs ${fmtN(d.el!)}`] : []),
      ...(d.de ? [`${d.label} enrollments ${fmtN(d.me!)} vs ${fmtN(d.ee!)}`] : []),
    ]);
    notes.push(`${block.displayName} · ${block.cohorts[cur]}: ${matrixTab} and ${econTab} disagree — ` +
      `${parts.join('; ')} (matrix vs economics). Both are shown as each tab states them.`);
  }
  return { notes, corrected };
}

// ─── "In Cohort" enrollments tab ──────────────────────────────────────────────
//
// Wharton: "Channel Tables - In Cohort Enrollments V2"; CBS: "In-Cohort Channel
// Tables V2". Same grammar as the matrix, one Enrollments section per program,
// counting only enrollments whose lead was created inside that cohort's own
// window (a summary table above the blocks gives In-Cohort / Past Cohort /
// Overall per cohort). Joined onto the matrix by program and position, with
// the shape checked label by label; the cohort columns are the matrix's own,
// because the tab's headers are incomplete (PE's "Current Cohort" header was
// blank on 10/6/26 with its values present).

export function attachInCohortV2(
  grid: Grid,
  programs: ProgramChannelBlock[],
  opts: { aliases?: Record<string, ProgramKey>; singleProgram?: ProgramKey; tabName: string },
): string[] {
  const notes: string[] = [];
  const blocks = findBlockColumns(grid);
  for (const [col, headers] of [...blocks.entries()].sort((a, b) => a[0] - b[0])) {
    const hdr = headers[0].row;
    const banner = bannerFor(grid, col, hdr);
    const key = banner
      ? resolveProgramKey(banner, opts.aliases)
      : blocks.size === 1 ? opts.singleProgram ?? null : null;
    const block = programs.find(p => p.program === key);
    if (!block) continue;
    const name = block.displayName;
    const n = block.cohorts.length;
    // Any header that IS present must name the matrix's cohort in that slot.
    const clash = block.cohorts.find((c, i) => {
      const h = S(cell(grid, hdr, col + 3 + i));
      return h !== '' && h !== c;
    });
    if (clash) {
      notes.push(`${opts.tabName} · ${name}: cohort columns don't line up with the matrix — in-cohort split not shown.`);
      continue;
    }
    const struct = readStructure(grid, col, hdr + 1);
    if ('fail' in struct) {
      notes.push(`${opts.tabName} · ${name}: ${struct.fail} — in-cohort split not shown.`);
      continue;
    }
    const shapeErr = (() => {
      if (struct.channels.length !== block.rows.length) return `${struct.channels.length} channels vs ${block.rows.length}`;
      for (let k = 0; k < block.rows.length; k++) {
        const a = struct.channels[k];
        const b = block.rows[k];
        if (labelKey(a.name) !== labelKey(b.channel)) return `"${a.name}" vs "${b.channel}"`;
        if (a.subs.length !== b.subs.length) return `"${a.name}" sub-channel count differs`;
        for (let j = 0; j < a.subs.length; j++) {
          if (labelKey(a.subs[j].name) !== labelKey(b.subs[j].name)) return `"${a.subs[j].name}" vs "${b.subs[j].name}"`;
        }
      }
      return null;
    })();
    if (shapeErr) {
      notes.push(`${opts.tabName} · ${name}: rows don't match the matrix (${shapeErr}) — in-cohort split not shown.`);
      continue;
    }

    // Same column presence as the matrix's enrollments.
    const col_ = (row: number) => valuesAt(grid, row, col, n)
      .map((v, i) => (block.totals.enrollments[i] === null ? null : v ?? 0));
    const over: string[] = [];
    struct.channels.forEach((ch, k) => {
      const row = block.rows[k];
      row.subs.forEach((s, j) => { s.inCohort = col_(ch.subs[j].row); });
      row.inCohort = row.subs.length ? sumCols(row.subs.map(s => s.inCohort!), n) : col_(ch.row);
      const parts = [
        { label: row.channel, p: row },
        ...row.subs.map(s => ({ label: `${row.channel} · ${s.name}`, p: s })),
      ];
      for (const { label, p } of parts) {
        p.inCohort!.forEach((v, i) => {
          const e = p.enrollments[i];
          if (v !== null && e !== null && v > e) {
            over.push(`${label}, ${block.cohorts[i]} (${fmtN(v)} in-cohort vs ${fmtN(e)} total)`);
          }
        });
      }
    });
    block.hasInCohort = true;
    if (over.length) {
      notes.push(`${opts.tabName} · ${name}: more in-cohort enrollments than enrollments for ` +
        `${over.slice(0, 4).join(', ')}${over.length > 4 ? ` and ${over.length - 4} more` : ''} — ` +
        `the two tabs aren't keyed to the same cut.`);
    }
    // The tab's Total row, checked against the rebuild.
    const sheetTotal = valuesAt(grid, struct.totalRow, col, n);
    const rebuilt = sumCols(block.rows.map(r => r.inCohort!), n);
    const bad = block.cohorts.filter((_, i) =>
      sheetTotal[i] !== null && rebuilt[i] !== null && Math.round(sheetTotal[i]!) !== Math.round(rebuilt[i]!));
    const errored = block.cohorts.filter((_, i) =>
      S(cell(grid, struct.totalRow, col + 3 + i)).startsWith('#'));
    if (bad.length || errored.length) {
      const parts = [
        errored.length ? `shows a formula error for ${errored.join(', ')}` : '',
        bad.length ? `doesn’t equal its rows for ${bad.join(', ')}` : '',
      ].filter(Boolean);
      notes.push(`${opts.tabName} · ${name}: the tab's Total row ${parts.join(' and ')}. ` +
        `The in-cohort split here is summed from the channel rows instead.`);
    }
  }
  return notes;
}
