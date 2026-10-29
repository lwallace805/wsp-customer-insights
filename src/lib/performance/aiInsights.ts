// AI-generated optimization insights for the Performance Dashboards.
//
// Claude (Opus 4.8, adaptive thinking) analyzes the full performance picture —
// historical cohorts, program history, live current-cohort pacing, traffic,
// paid platforms, self-study — and returns prioritized insights in the same
// Insight shape the UI renders.
//
// Regenerated once per DAY, anchored to midnight Pacific: the cache key is
// the Pacific calendar date, and a Vercel cron (vercel.json →
// /api/performance/cron, 08:00 UTC = midnight PST) generates the new
// briefing proactively so no visitor waits through generation.
// POST /api/performance/refresh forces an early regeneration. Falls back to
// the rule-based engine (insights.ts) when ANTHROPIC_API_KEY is missing, in
// demo mode, or on any API error.
//
// Paid platform figures come from the live paid layer (paidLive.ts), the same
// read the Paid Optimization and Paid Channel pages render. Each school's
// entry in the payload states the cohort its figures describe and whether
// they were read live from that cohort's doc today or are the curated Spring
// 2026 snapshot served in its place, and the system prompt tells the model to
// treat a snapshot as a closed prior cohort — never as the cohort enrolling.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { unstable_cache } from 'next/cache';
import { WHARTON_HISTORY, COLUMBIA_HISTORY, WHARTON_CURRENT_CHANNELS } from '@/data/performance/historical';
import { PROGRAM_HISTORY } from '@/data/performance/programHistory';
import { CHANNEL_TRAFFIC, SITEWIDE_YOY, CERT_PAGES_WHARTON_YOY, CERT_PAGES_COLUMBIA_YOY } from '@/data/performance/traffic';
import { SELF_STUDY_2026 } from '@/data/performance/selfStudy';
import { CBS_PAID_PLATFORMS, CBS_PAID_WEEKLY, CBS_PRIOR_COHORT } from '@/data/performance/paidChannels';
import {
  CHANNEL_LABEL, STATIC_PAID_DATA, derive, sumCounts,
  type PaidData, type RawCounts,
} from '@/data/performance/paidOptimization';
import { computeInsights } from './insights';
import { getCurrentSnapshot } from './live';
import { getPaidPerformance } from './paidLive';
import { isDemo } from '@/lib/demo/flag';
import type { CurrentSnapshot, Insight, School } from '@/data/performance/types';

// ── Output schema ─────────────────────────────────────────────────────────────

const AiInsightSchema = z.object({
  severity: z.enum(['critical', 'warning', 'positive']),
  school: z.enum(['wharton', 'columbia', 'both']),
  title: z.string(),
  evidence: z.array(z.string()),
  action: z.string(),
});

const AiInsightsResponseSchema = z.object({
  summary: z.string(),
  insights: z.array(AiInsightSchema),
});

export interface InsightsResult {
  source: 'ai' | 'rules';
  summary: string | null;
  insights: Insight[];
  generatedAt: string;     // ISO date
  model?: string;
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the senior performance marketing analyst for Wall Street Prep (WSP). WSP sells cohort-based certificate programs through two university partnerships — Wharton Online (PE, Real Estate, FP&A, Applied Value Investing, Restructuring & Distressed Investing) and Columbia Business School (AI for Business & Finance) — plus a self-study/retail business.

You will receive a JSON payload of WSP's full marketing performance picture: historical cohort performance, per-program lead/CVR history, the current cohort's real-time pacing vs forecast vs target, paid platform performance, GA4 traffic, and self-study revenue.

Your job: produce the Optimization Priorities briefing the marketing team acts on this week.

Rules:
- Produce 10-16 insights. Every insight must be grounded in specific numbers from the payload — quote the actual figures in the evidence bullets. Never invent numbers.
- severity: "critical" = act this week, material revenue risk or large fast-moving decline. "warning" = investigate soon, negative trend or inefficiency. "positive" = something working that deserves protection or more budget.
- school: "wharton", "columbia", or "both" depending on which business the insight concerns.
- title: one sharp sentence with the key number in it.
- evidence: 2-4 bullets, each citing concrete figures from the payload (with units: $, %, x).
- action: one concrete, specific recommendation — what to change, where, and why it should work. Write like an operator, not a consultant.
- Prioritize insights a media buyer or marketing lead can actually act on: budget reallocation, creative/audience changes, channel shifts, funnel fixes, attribution gaps, forecast risks.
- Think cross-source: connect paid spend efficiency to lead gaps to enrollment pacing where the data supports it.
- Paid platform figures (paidPlatforms.wharton / paidPlatforms.columbia) each carry "cohort", "state" and "describesCurrentCohort". Only an entry with describesCurrentCohort = true is the current cohort's paid performance. An entry in state "snapshot" or "unpopulated" is a CLOSED prior cohort's data, served because the current cohort's paid tables cannot be read yet: use it only as history, name its cohort whenever you cite it, never present it as current paid performance, and never divide it by or compare it against the current cohort's enrollments, leads or pacing. If a school's current-cohort paid figures are unavailable, say so rather than inferring current paid efficiency from the snapshot.
- Mind the data caveats included in the payload (bot-inflated leads, GA4 reclassification, in-progress cohorts) — do not present artifacts as trends, and call them out where they distort the picture.
- summary: a 3-5 sentence executive read of the overall state of the business and the single most important thing to do now.`;

// ── Data payload ──────────────────────────────────────────────────────────────

const SCHOOL_NAME: Record<School, string> = { wharton: 'Wharton', columbia: 'Columbia' };

/** One school's paid figures with their provenance spelled out for the model:
 *  the cohort they describe, whether they are the current cohort's (live from
 *  its doc today) or the curated snapshot of a closed one, and — part by
 *  part — the same for the weekly series and Wharton's program × channel
 *  leaves, which can stay on the snapshot while the channel totals are live. */
function paidSchoolPayload(paid: PaidData, school: School) {
  const src = paid.sources[school];
  const live = src.state === 'live';
  const channels = paid.channelsBySchool[school];
  const snapshotCohort = STATIC_PAID_DATA.cohortContext[school].cohort;
  const withMetrics = <T extends RawCounts>(r: T) => derive(r, school);
  const basis = live
    ? `Read today from the ${src.cohort} cohort doc — the current cohort, in progress, cohort-to-date.`
    : `Curated snapshot of the ${src.cohort} cohort as of ${STATIC_PAID_DATA.asOf} — a CLOSED prior cohort, not the current one (${src.docCohort ?? 'the current cohort'}). ${src.note ?? ''}`.trim();
  return {
    cohort: src.cohort,
    state: src.state,
    describesCurrentCohort: live,
    currentCohort: src.docCohort,
    basis,
    channels: channels.map(c => ({ ...withMetrics(c), channel: CHANNEL_LABEL[c.channel] })),
    total: withMetrics(sumCounts(channels)),
    weekly: {
      cohort: src.weeklyLive ? src.cohort : snapshotCohort,
      describesCurrentCohort: src.weeklyLive,
      series: paid.weekly[school],
    },
    ...(school === 'wharton'
      ? {
          programByChannel: {
            cohort: src.programsLive ? src.cohort : snapshotCohort,
            describesCurrentCohort: src.programsLive,
            note: 'Spend is program-attributed; Google brand/generic search is not tagged to a program, so Google program rows sum to less than the Google channel total. Leads and enrollments sum exactly.',
            leaves: paid.whartonProgramChannel.map(l => ({ ...withMetrics(l), channel: CHANNEL_LABEL[l.channel] })),
          },
        }
      : {}),
  };
}

/** The paid caveat line: which cohort each school's paid figures are, in words. */
function paidCaveat(paid: PaidData): string {
  const part = (s: School) => {
    const src = paid.sources[s];
    if (src.state === 'live') return `${SCHOOL_NAME[s]} — ${src.cohort}, live from its cohort doc (the current cohort)`;
    const why = src.state === 'unpopulated' ? 'its paid tables read $0 on every platform' : 'its cohort doc could not be read';
    return `${SCHOOL_NAME[s]} — the ${src.cohort} snapshot (${STATIC_PAID_DATA.asOf}) of a CLOSED cohort, because the current ${src.docCohort ?? 'cohort'} doc is not readable yet (${why}); current-cohort paid performance for ${SCHOOL_NAME[s]} is unavailable`;
  };
  return `Paid platform figures: ${part('wharton')}; ${part('columbia')}. Each paidPlatforms entry's "state" / "describesCurrentCohort" is authoritative.`;
}

/** The current cohorts' window and days remaining, where the paid layer rebuilt
 *  them from the same cohort the enrollment snapshot describes. */
function cohortWindows(snapshot: CurrentSnapshot, paid: PaidData) {
  const out: Partial<Record<School, { dateRange: string; daysRemaining: number | null }>> = {};
  for (const s of ['wharton', 'columbia'] as School[]) {
    const ctx = paid.cohortContext[s];
    if (paid.sources[s].state === 'live' && ctx.cohort === snapshot.cohortLabels[s]) {
      out[s] = { dateRange: ctx.dateRange, daysRemaining: ctx.daysRemaining };
    }
  }
  return out;
}

export function buildInsightsPayload(snapshot: CurrentSnapshot, paid: PaidData) {
  const labels = snapshot.cohortLabels;
  return {
    asOfDate: snapshot.asOf,
    dataCaveats: [
      'Wharton Spring 2025 + Fall 2025 raw lead counts are bot-inflated; bot-adjusted counts in leadsExBots. Per-program Fall 2025 leads are NOT bot-adjusted, so F25 program CVRs are understated.',
      'GA4: from week of 2026-03-01, Direct sessions jump ~3x while Other drops — a channel reclassification, not a real traffic shift.',
      `Current cohorts, in progress — enrollments and leads are not final: Wharton ${labels.wharton}, Columbia ${labels.columbia} (currentCohorts.cohortLabels; windows in currentCohorts.windows where known).`,
      paidCaveat(paid),
      `Columbia ${CBS_PRIOR_COHORT.label} LinkedIn spend included a $44K employer-sponsored test driving cheap, low-converting leads (paidPlatforms.columbiaPriorCohort).`,
      'whartonSpring2026ChannelEnrolls is a mid-cohort snapshot (2026-06-10) of a cohort that has since closed — channel-mix history only, not the current cohort and not its final.',
    ],
    currentCohorts: {
      cohortLabels: labels,
      windows: cohortWindows(snapshot, paid),
      forecastNote: snapshot.forecastNote,
      programs: snapshot.programs,
      paidVsOrganic: snapshot.paidVsOrganic,
      channelMix: snapshot.channelMix,
    },
    whartonCohortHistory: WHARTON_HISTORY,
    columbiaCohortHistory: COLUMBIA_HISTORY,
    whartonSpring2026ChannelEnrolls: {
      ...WHARTON_CURRENT_CHANNELS,
      inProgress: false,
      note: 'Spring 2026 cohort, closed 2026-06-15; channel-attributed enrollments as of a 2026-06-10 mid-cohort snapshot, not the final.',
    },
    programHistory: PROGRAM_HISTORY,
    paidPlatforms: {
      asOf: paid.asOf,
      wharton: paidSchoolPayload(paid, 'wharton'),
      columbia: paidSchoolPayload(paid, 'columbia'),
      columbiaPriorCohort: {
        cohort: CBS_PRIOR_COHORT.label,
        snapshotAsOf: CBS_PRIOR_COHORT.asOf,
        describesCurrentCohort: false,
        platforms: CBS_PAID_PLATFORMS,
        weeklyGoogle: CBS_PAID_WEEKLY,
      },
    },
    traffic: {
      weeklyByChannel: CHANNEL_TRAFFIC,
      sitewideYoY: SITEWIDE_YOY,
      certPagesWhartonYoY: CERT_PAGES_WHARTON_YOY,
      certPagesColumbiaYoY: CERT_PAGES_COLUMBIA_YOY,
    },
    selfStudy2026: SELF_STUDY_2026,
  };
}

// ── Generation ────────────────────────────────────────────────────────────────

const MODEL = 'claude-opus-4-8';

// dayKey exists purely to scope the cache: unstable_cache keys on args, so
// the key is the Pacific calendar date (rolls over at midnight PT) and the
// snapshot and paid bundle are fetched inside.
async function generateAiInsights(dayKey: string): Promise<InsightsResult | null> {
  void dayKey;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const [snapshot, paid] = await Promise.all([getCurrentSnapshot(), getPaidPerformance()]);
  const client = new Anthropic({ apiKey });

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Here is the current performance data payload. Produce the optimization briefing.\n\n${JSON.stringify(buildInsightsPayload(snapshot, paid))}`,
      },
    ],
    output_config: {
      format: zodOutputFormat(AiInsightsResponseSchema),
    },
  });

  const parsed = response.parsed_output;
  if (!parsed || !parsed.insights.length) return null;

  const order = { critical: 0, warning: 1, positive: 2 } as const;
  const insights: Insight[] = parsed.insights
    .map((i, idx) => ({ ...i, id: `ai-${idx}` }))
    .sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    source: 'ai',
    summary: parsed.summary,
    insights,
    generatedAt: new Date().toISOString().slice(0, 10),
    model: MODEL,
  };
}

// Cached DAILY, anchored to midnight Pacific (~$0.30/run on Opus 4.8 →
// ~$9/month). The Pacific-date cache key rolls over at midnight PT; the
// Vercel cron generates the new day's briefing right after rollover.
// POST /api/performance/refresh (tag 'performance') regenerates immediately.
// Bump the key when the payload shape changes (v2: paid figures from the live
// paid layer with per-school provenance) so a cached briefing built on the old
// input doesn't outlive the deploy.
const cachedGenerate = unstable_cache(generateAiInsights, ['performance-ai-insights-v2'], {
  revalidate: 86400,
  tags: ['performance'],
});

/** Today's date in Pacific time (YYYY-MM-DD) — the daily cache key. */
function pacificDayKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

export async function getInsights(snapshot: CurrentSnapshot): Promise<InsightsResult> {
  if (!isDemo() && process.env.ANTHROPIC_API_KEY) {
    try {
      const ai = await cachedGenerate(pacificDayKey());
      if (ai) return ai;
    } catch (err) {
      console.error('[performance/aiInsights] falling back to rule-based insights:', err);
    }
  }
  return {
    source: 'rules',
    summary: null,
    insights: computeInsights(snapshot),
    generatedAt: snapshot.asOf,
  };
}
