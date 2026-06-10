// Optimization insights — pure functions computing prioritized findings from
// the historical snapshot + current cohort data. No I/O.

import { WHARTON_HISTORY, COLUMBIA_HISTORY } from '@/data/performance/historical';
import { PROGRAM_HISTORY } from '@/data/performance/programHistory';
import { CHANNEL_TRAFFIC } from '@/data/performance/traffic';
import { PROGRAM_LABELS, type CurrentSnapshot, type Insight } from '@/data/performance/types';

function last<T>(arr: T[]): T { return arr[arr.length - 1]; }

export function computeInsights(snapshot: CurrentSnapshot): Insight[] {
  const insights: Insight[] = [];

  // ── 1. Current cohort lead-gap flags ──────────────────────────────────────
  for (const p of snapshot.programs) {
    const { realTime, forecast } = p.leads;
    if (forecast > 0) {
      const gapPct = ((realTime - forecast) / forecast) * 100;
      if (gapPct <= -20) {
        insights.push({
          id: `lead-gap-${p.program}`,
          severity: gapPct <= -35 ? 'critical' : 'warning',
          school: p.program === 'ai' ? 'columbia' : 'wharton',
          title: `${PROGRAM_LABELS[p.program]}: leads ${Math.abs(gapPct).toFixed(0)}% behind forecast`,
          evidence: [
            `${realTime.toLocaleString()} leads vs ${forecast.toLocaleString()} forecast (target ${p.leads.finalTarget.toLocaleString()})`,
            `Enrollments: ${p.enrolls.realTime} vs ${p.enrolls.forecast} forecast`,
          ],
          action: 'Increase top-of-funnel spend or expand creative testing for this program now — lead gaps this far into the cycle compound at the enrollment deadline.',
        });
      } else if (gapPct >= 10) {
        insights.push({
          id: `lead-ahead-${p.program}`,
          severity: 'positive',
          school: p.program === 'ai' ? 'columbia' : 'wharton',
          title: `${PROGRAM_LABELS[p.program]}: leads ${gapPct.toFixed(0)}% ahead of forecast`,
          evidence: [
            `${realTime.toLocaleString()} leads vs ${forecast.toLocaleString()} forecast`,
            p.leadCvr != null ? `Current CVR ${p.leadCvr.toFixed(1)}%` : 'CVR n/a',
          ],
          action: 'Protect what is working — maintain budget and document the creative/channel mix driving the overperformance.',
        });
      }
    }
  }

  // ── 2. Program CVR decline (historical) ───────────────────────────────────
  for (const ph of PROGRAM_HISTORY) {
    const valid = ph.stats.filter(s => s.cvr != null);
    if (valid.length < 2) continue;
    const first = valid[0].cvr!;
    const latest = last(valid).cvr!;
    const dropPct = ((latest - first) / first) * 100;
    if (dropPct <= -25) {
      insights.push({
        id: `cvr-decline-${ph.program}`,
        severity: dropPct <= -45 ? 'critical' : 'warning',
        school: ph.program === 'ai' ? 'columbia' : 'wharton',
        title: `${PROGRAM_LABELS[ph.program]}: lead CVR down ${Math.abs(dropPct).toFixed(0)}% since ${valid[0].cohort}`,
        evidence: [
          `${first.toFixed(1)}% (${valid[0].cohort}) → ${latest.toFixed(1)}% (${last(valid).cohort})`,
          'Bot-lead inflation affects Spring/Fall 2025 denominators — but the decline pre-dates the bot issue.',
        ],
        action: 'Audit lead quality by source for this program; consider tightening prospecting audiences and adding lead-form qualification questions.',
      });
    } else if (dropPct >= 25) {
      insights.push({
        id: `cvr-improve-${ph.program}`,
        severity: 'positive',
        school: ph.program === 'ai' ? 'columbia' : 'wharton',
        title: `${PROGRAM_LABELS[ph.program]}: lead CVR up ${dropPct.toFixed(0)}% since launch`,
        evidence: [`${first.toFixed(1)}% (${valid[0].cohort}) → ${latest.toFixed(1)}% (${last(valid).cohort})`],
        action: 'Codify what changed (audience, nurture, offer) and apply the playbook to lagging programs.',
      });
    }
  }

  // ── 3. Wharton paid efficiency decay ──────────────────────────────────────
  {
    const recent = WHARTON_HISTORY.slice(-3);
    const latest = last(WHARTON_HISTORY);
    const peak = Math.max(...WHARTON_HISTORY.map(c => c.ppcRoas));
    if (latest.ppcRoas < 2.5) {
      insights.push({
        id: 'wharton-ppc-roas',
        severity: latest.ppcRoas < 2.0 ? 'critical' : 'warning',
        school: 'wharton',
        title: `Wharton PPC ROAS at ${latest.ppcRoas.toFixed(1)}x — below the 2.5x efficiency line`,
        evidence: [
          `Last 3 cohorts: ${recent.map(c => `${c.shortLabel} ${c.ppcRoas.toFixed(1)}x`).join(' · ')}`,
          `Peak was ${peak.toFixed(1)}x (Fall 2023); PPC spend has grown to $${(latest.ppcSpend! / 1000).toFixed(0)}K/cohort`,
          `CPE ${WHARTON_HISTORY.slice(-3).map(c => `$${c.cpe}`).join(' → ')}`,
        ],
        action: 'Paid spend is scaling faster than paid enrollments. Rebalance budget toward the highest-ROAS programs and pressure-test incrementality of the marginal PPC dollar.',
      });
    }
  }

  // ── 4. Offline/Direct attribution gap ─────────────────────────────────────
  {
    const first = WHARTON_HISTORY[0];
    const latest = last(WHARTON_HISTORY);
    const firstPct = ((first.channelEnrolls.offline ?? 0) / first.totalEnrolls) * 100;
    const latestPct = ((latest.channelEnrolls.offline ?? 0) / latest.totalEnrolls) * 100;
    if (latestPct - firstPct > 8) {
      insights.push({
        id: 'attribution-gap',
        severity: 'warning',
        school: 'wharton',
        title: `Offline/Direct (unattributed) enrollments now ${latestPct.toFixed(0)}% of total — up from ${firstPct.toFixed(0)}%`,
        evidence: [
          `${first.shortLabel}: ${first.channelEnrolls.offline} enrolls → ${latest.shortLabel}: ${latest.channelEnrolls.offline}`,
          'A fifth of enrollments have unknown channel origin, which distorts every per-channel ROAS and CPE figure.',
        ],
        action: 'Invest in attribution hygiene: post-purchase "how did you hear about us" survey, UTM enforcement, and offline conversion imports — before reallocating budget on flawed channel data.',
      });
    }
  }

  // ── 5. AI referral emergence ──────────────────────────────────────────────
  {
    const latest = last(WHARTON_HISTORY);
    const aiEnrolls = latest.channelEnrolls.aiReferral ?? 0;
    const t25 = CHANNEL_TRAFFIC.find(t => t.year === 2025)!;
    const t26 = CHANNEL_TRAFFIC.find(t => t.year === 2026)!;
    let ai25 = 0, ai26 = 0;
    t26.ai.forEach((v, i) => { if (v != null && t25.ai[i] != null) { ai26 += v; ai25 += t25.ai[i]!; } });
    const aiTrafficDelta = ai25 > 0 ? ((ai26 - ai25) / ai25) * 100 : 0;
    if (aiEnrolls > 0) {
      insights.push({
        id: 'ai-referral-growth',
        severity: 'positive',
        school: 'both',
        title: `AI referral is a real channel now: ${aiEnrolls} Wharton enrollments in ${latest.cohort}`,
        evidence: [
          `Channel went 0 → 10 (F'25) → ${aiEnrolls} (${latest.shortLabel}) enrollments`,
          `AI referral traffic ${aiTrafficDelta >= 0 ? '+' : ''}${aiTrafficDelta.toFixed(0)}% YoY (like-for-like weeks)`,
        ],
        action: 'Invest in AI-engine visibility (structured program data, citations, comparison content). This is the fastest-growing zero-CAC channel.',
      });
    }
  }

  // ── 6. SEO traffic decline ────────────────────────────────────────────────
  {
    const t25 = CHANNEL_TRAFFIC.find(t => t.year === 2025)!;
    const t26 = CHANNEL_TRAFFIC.find(t => t.year === 2026)!;
    let seo25 = 0, seo26 = 0;
    t26.seo.forEach((v, i) => { if (v != null && t25.seo[i] != null) { seo26 += v; seo25 += t25.seo[i]!; } });
    const delta = seo25 > 0 ? ((seo26 - seo25) / seo25) * 100 : 0;
    if (delta < -20) {
      insights.push({
        id: 'seo-decline',
        severity: 'critical',
        school: 'both',
        title: `SEO sessions down ${Math.abs(delta).toFixed(0)}% YoY`,
        evidence: [
          `${seo26.toLocaleString()} (2026 YTD) vs ${seo25.toLocaleString()} (same weeks 2025)`,
          'Yet organic search still delivers ~120 Wharton enrollments/cohort — the conversion base is eroding from the top.',
        ],
        action: 'Commission an SEO traffic-loss audit (algorithm updates, AI Overviews cannibalization, page pruning). Defend the highest-converting organic pages first.',
      });
    }
  }

  // ── 7. Columbia efficiency trajectory ─────────────────────────────────────
  {
    const cols = COLUMBIA_HISTORY;
    if (cols.length >= 2) {
      const first = cols[0];
      const latest = last(cols);
      if (latest.leadCvr > first.leadCvr * 1.4) {
        insights.push({
          id: 'columbia-cvr-up',
          severity: 'positive',
          school: 'columbia',
          title: `Columbia lead CVR nearly doubled: ${first.leadCvr.toFixed(1)}% → ${latest.leadCvr.toFixed(1)}%`,
          evidence: [
            cols.map(c => `${c.shortLabel}: ${c.leadCvr.toFixed(1)}%`).join(' · '),
            `Blended ROAS holding strong at ${latest.blendedRoas.toFixed(1)}x`,
          ],
          action: 'Lead volume is the binding constraint, not conversion. Scale AI program top-of-funnel while CVR is this strong.',
        });
      }
      if (latest.cpl > first.cpl * 1.3) {
        insights.push({
          id: 'columbia-cpl-up',
          severity: 'warning',
          school: 'columbia',
          title: `Columbia CPL up ${(((latest.cpl - first.cpl) / first.cpl) * 100).toFixed(0)}% since launch ($${first.cpl} → $${latest.cpl})`,
          evidence: [
            cols.map(c => `${c.shortLabel}: $${c.cpl}`).join(' · '),
            `Lead volume fell each cohort: ${cols.map(c => (c.leadsExBots ?? c.totalLeads).toLocaleString()).join(' → ')}`,
          ],
          action: 'Rising CPL on falling volume signals audience saturation in current targeting. Test new audiences/creative angles before raising budget.',
        });
      }
    }
  }

  // ── 8. Bot-lead data quality ──────────────────────────────────────────────
  {
    const affected = WHARTON_HISTORY.filter(c => c.leadsExBots != null && c.totalLeads !== c.leadsExBots);
    if (affected.length) {
      insights.push({
        id: 'bot-leads',
        severity: 'warning',
        school: 'wharton',
        title: 'Bot leads inflated raw lead counts in Spring + Fall 2025',
        evidence: affected.map(c => `${c.cohort}: ${c.totalLeads.toLocaleString()} raw → ${c.leadsExBots!.toLocaleString()} adjusted (${(((c.totalLeads - c.leadsExBots!) / c.totalLeads) * 100).toFixed(0)}% bots)`),
        action: 'Ensure bot filtering is permanent in the lead pipeline and that all CVR/CPL reporting uses adjusted lead counts.',
      });
    }
  }

  // Sort: critical → warning → positive
  const order = { critical: 0, warning: 1, positive: 2 } as const;
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
}
