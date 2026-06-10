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

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { unstable_cache } from 'next/cache';
import { WHARTON_HISTORY, COLUMBIA_HISTORY, WHARTON_CURRENT_CHANNELS } from '@/data/performance/historical';
import { PROGRAM_HISTORY } from '@/data/performance/programHistory';
import { CHANNEL_TRAFFIC, SITEWIDE_YOY, CERT_PAGES_WHARTON_YOY, CERT_PAGES_COLUMBIA_YOY } from '@/data/performance/traffic';
import { SELF_STUDY_2026 } from '@/data/performance/selfStudy';
import {
  WHARTON_PAID_OVERALL, WHARTON_PAID_GOOGLE, WHARTON_PAID_WEEKLY,
  CBS_SPRING_GOOGLE, CBS_SPRING_WEEKLY, CBS_PAID_PLATFORMS, CBS_PAID_WEEKLY,
} from '@/data/performance/paidChannels';
import { computeInsights } from './insights';
import { getCurrentSnapshot } from './live';
import { isDemo } from '@/lib/demo/flag';
import type { CurrentSnapshot, Insight } from '@/data/performance/types';

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
- Mind the data caveats included in the payload (bot-inflated leads, GA4 reclassification, in-progress cohorts) — do not present artifacts as trends, and call them out where they distort the picture.
- summary: a 3-5 sentence executive read of the overall state of the business and the single most important thing to do now.`;

// ── Data payload ──────────────────────────────────────────────────────────────

function buildPayload(snapshot: CurrentSnapshot) {
  return {
    asOfDate: snapshot.asOf,
    dataCaveats: [
      'Wharton Spring 2025 + Fall 2025 raw lead counts are bot-inflated; bot-adjusted counts in leadsExBots. Per-program Fall 2025 leads are NOT bot-adjusted, so F25 program CVRs are understated.',
      'GA4: from week of 2026-03-01, Direct sessions jump ~3x while Other drops — a channel reclassification, not a real traffic shift.',
      'Current Wharton and Columbia cohorts (both Spring 2026) are in progress — their enrollments/leads are not final. Wharton ends ~6/15; Columbia runs 3/24 → 7/20.',
      'Wharton paid media is Google-dominated; Meta/LinkedIn are not broken out for Wharton. Columbia Spring 2026 paid is Google-only so far. Columbia Winter 2026 (prior) LinkedIn spend included a $44K employer-sponsored test driving cheap, low-converting leads.',
    ],
    currentCohorts: {
      cohortLabels: snapshot.cohortLabels,
      forecastNote: snapshot.forecastNote,
      programs: snapshot.programs,
      paidVsOrganic: snapshot.paidVsOrganic,
      channelMix: snapshot.channelMix,
    },
    whartonCohortHistory: WHARTON_HISTORY,
    columbiaCohortHistory: COLUMBIA_HISTORY,
    whartonCurrentCohortChannels: WHARTON_CURRENT_CHANNELS,
    programHistory: PROGRAM_HISTORY,
    paidPlatforms: {
      whartonOverallByProgram: WHARTON_PAID_OVERALL,
      whartonGoogleByProgram: WHARTON_PAID_GOOGLE,
      whartonWeeklyPaid: WHARTON_PAID_WEEKLY,
      columbiaCurrentSpringGoogle: CBS_SPRING_GOOGLE,
      columbiaCurrentSpringWeekly: CBS_SPRING_WEEKLY,
      columbiaPriorWinterPlatforms: CBS_PAID_PLATFORMS,
      columbiaPriorWinterWeeklyGoogle: CBS_PAID_WEEKLY,
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
// snapshot is fetched inside.
async function generateAiInsights(dayKey: string): Promise<InsightsResult | null> {
  void dayKey;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const snapshot = await getCurrentSnapshot();
  const client = new Anthropic({ apiKey });

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Here is the current performance data payload. Produce the optimization briefing.\n\n${JSON.stringify(buildPayload(snapshot))}`,
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
const cachedGenerate = unstable_cache(generateAiInsights, ['performance-ai-insights-v1'], {
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
