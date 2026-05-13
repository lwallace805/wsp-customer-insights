import { NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/airtable';
import { calculateNPS } from '@/lib/nps';
import { isCertProgram, matchProgram, THEMES, extractThemes, CERT_PROGRAMS } from '@/lib/certPrograms';

const NPS_TABLE        = process.env.NPS_TABLE_NAME        || 'Course Survey Results';
const SCORE_FIELD      = process.env.NPS_SCORE_FIELD       || 'Recommend Likelihood (Number)';
const DATE_FIELD       = process.env.NPS_DATE_FIELD        || 'Response Date';
const COMMENT_FIELD    = process.env.NPS_COMMENT_FIELD     || 'Recommendation Reasoning';
const PRODUCT_FIELD    = process.env.NPS_PRODUCT_FIELD     || 'Survey Name';
const RESPONDENT_FIELD = process.env.NPS_RESPONDENT_FIELD  || 'Name';

function lookup(v: unknown): string {
  if (Array.isArray(v)) return String(v[0] ?? '');
  return String(v ?? '');
}

export async function GET() {
  try {
    const records = await getAllRecords(NPS_TABLE);

    const responses = records
      .map(r => {
        const surveyName = lookup(r.fields[PRODUCT_FIELD]);
        const program    = matchProgram(surveyName);
        return {
          score:      Number(r.fields[SCORE_FIELD]),
          date:       String(r.fields[DATE_FIELD] || ''),
          surveyName,
          program:    program?.label ?? null,
          comment:    String(r.fields[COMMENT_FIELD] || ''),
          respondent: String(r.fields[RESPONDENT_FIELD] || ''),
          courseRating:    Number(r.fields['Course Rating'])    || 0,
          presenterRating: Number(r.fields['Presenter Rating']) || 0,
          relevanceRating: Number(r.fields['Relevance'])        || 0,
          materialsRating: Number(r.fields['Materials Rating']) || 0,
          themes:     extractThemes(String(r.fields[COMMENT_FIELD] || '')),
        };
      })
      .filter(r => !isNaN(r.score) && r.score >= 0 && r.score <= 10 && isCertProgram(r.surveyName));

    const overall = calculateNPS(responses.map(r => r.score));

    const byProgram = CERT_PROGRAMS.map(prog => {
      const rs = responses.filter(r => r.program === prog.label);
      if (!rs.length) return null;
      const nps = calculateNPS(rs.map(r => r.score));
      const promoters  = rs.filter(r => r.score >= 9);
      const detractors = rs.filter(r => r.score <= 6);
      const themeMap: Record<string, number> = {};
      rs.forEach(r => r.themes.forEach(t => { themeMap[t] = (themeMap[t] || 0) + 1; }));
      const topThemes = Object.entries(themeMap).sort((a,b) => b[1]-a[1]).slice(0,5).map(([id]) => THEMES.find(t => t.id === id)?.label ?? id);
      return {
        program:        prog.label,
        npsScore:       nps.score,
        totalResponses: nps.totalResponses,
        promoterPct:    nps.promoterPct,
        passivePct:     nps.passivePct,
        detractorPct:   nps.detractorPct,
        avgRatings: {
          course:    +(rs.reduce((s,r) => s+r.courseRating,0) / rs.filter(r=>r.courseRating).length || 0).toFixed(1),
          presenter: +(rs.reduce((s,r) => s+r.presenterRating,0) / rs.filter(r=>r.presenterRating).length || 0).toFixed(1),
          materials: +(rs.reduce((s,r) => s+r.materialsRating,0) / rs.filter(r=>r.materialsRating).length || 0).toFixed(1),
        },
        topThemes,
        promoterVoices:  promoters.filter(r=>r.comment.length>15).slice(0,10).map(r=>r.comment),
        detractorVoices: detractors.filter(r=>r.comment.length>15).slice(0,10).map(r=>r.comment),
      };
    }).filter(Boolean);

    const allPromoterComments  = responses.filter(r => r.score >= 9 && r.comment.length > 15).map(r => r.comment);
    const allDetractorComments = responses.filter(r => r.score <= 6 && r.comment.length > 15).map(r => r.comment);

    const themeFrequency: Record<string, { promoter: number; detractor: number; total: number }> = {};
    responses.forEach(r => {
      r.themes.forEach(t => {
        if (!themeFrequency[t]) themeFrequency[t] = { promoter: 0, detractor: 0, total: 0 };
        themeFrequency[t].total++;
        if (r.score >= 9) themeFrequency[t].promoter++;
        if (r.score <= 6) themeFrequency[t].detractor++;
      });
    });

    const themesSorted = Object.entries(themeFrequency)
      .sort((a,b) => b[1].total - a[1].total)
      .map(([id, counts]) => ({ theme: THEMES.find(t=>t.id===id)?.label ?? id, ...counts }));

    const doc = `# WSP University Certificate Programs — Learner Intelligence Report
Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
Data source: Live Airtable · ${responses.length} total responses

---

## EXECUTIVE SUMMARY

**Overall NPS: ${overall.score}**
- ${overall.promoterPct}% Promoters (score 9–10)
- ${overall.passivePct}% Passives (score 7–8)
- ${overall.detractorPct}% Detractors (score 0–6)
- Total responses: ${overall.totalResponses}

---

## PERFORMANCE BY PROGRAM

${byProgram.map(p => p && `### ${p.program}
- NPS Score: **${p.npsScore}**
- Responses: ${p.totalResponses} (${p.promoterPct}% Promoters / ${p.passivePct}% Passives / ${p.detractorPct}% Detractors)
- Avg Ratings: Course ${p.avgRatings.course}/5 | Presenter ${p.avgRatings.presenter}/5 | Materials ${p.avgRatings.materials}/5
- Top themes: ${p.topThemes.join(', ')}
`).join('\n')}

---

## WHAT PROMOTERS SAY (Score 9–10)
${allPromoterComments.slice(0,20).map(c => `- "${c}"`).join('\n')}

---

## WHAT DETRACTORS SAY (Score 0–6)
${allDetractorComments.slice(0,20).map(c => `- "${c}"`).join('\n')}

---

## THEME ANALYSIS

The following themes were identified across ${responses.filter(r=>r.comment.length>10).length} open-text responses:

${themesSorted.map(t => `**${t.theme}** — ${t.total} mentions
  Promoter mentions: ${t.promoter} | Detractor mentions: ${t.detractor}
`).join('\n')}

---

## MARKETING & POSITIONING SIGNALS

### Proof Points (from Promoter language)
${allPromoterComments.slice(0,8).map(c => `> "${c}"`).join('\n')}

### Pain Points / Objections to Address (from Detractor language)
${allDetractorComments.slice(0,8).map(c => `> "${c}"`).join('\n')}

### Audience Framing
- These learners are motivated by practical, real-world application
- Instructor quality is a primary driver of promoter status
- Content density / pacing is the most common friction point

---

## NOTES FOR LLM / MESSAGING USE

This document is structured for use as context in AI-assisted marketing and positioning work.
When using this data to generate messaging, prioritize:
1. The exact language from Promoter quotes — these are authentic proof points
2. The top-performing programs' NPS scores as social proof
3. Theme data to understand what learners value most vs. where friction exists
4. Detractor feedback as insight into objections to pre-empt in copy

---
*Generated by WSP Customer Insights Dashboard · ${new Date().toISOString()}*
`;

    return new NextResponse(doc, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="wsp-learner-intelligence-${new Date().toISOString().slice(0,10)}.txt"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
