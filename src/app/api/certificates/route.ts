import { NextRequest, NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/airtable';
import { calculateNPS } from '@/lib/nps';
import {
  CERT_PROGRAMS, COHORT_ORDER, isCertProgram, matchProgram,
  matchProgramByLabel, THEMES, extractThemes,
} from '@/lib/certPrograms';
import historicalData from '@/data/historicalNPS.json';

const NPS_TABLE        = process.env.NPS_TABLE_NAME       || 'Course Survey Results';
const SCORE_FIELD      = process.env.NPS_SCORE_FIELD      || 'Recommend Likelihood (Number)';
const DATE_FIELD       = process.env.NPS_DATE_FIELD       || 'Response Date';
const COMMENT_FIELD    = process.env.NPS_COMMENT_FIELD    || 'Recommendation Reasoning';
const RESPONDENT_FIELD = process.env.NPS_RESPONDENT_FIELD || 'Name';
const PRODUCT_FIELD    = process.env.NPS_PRODUCT_FIELD    || 'Survey Name';

type NormalizedResponse = {
  id: string;
  score: number;
  date: string;
  cohort: string;
  programId: string;
  programLabel: string;
  comment: string;
  respondent: string;
  source: 'live' | 'historical';
  courseRating?: number;
  presenterRating?: number;
  materialsRating?: number;
  themes: string[];
};

function lookup(v: unknown): string {
  if (Array.isArray(v)) return String(v[0] ?? '');
  return String(v ?? '');
}

function dateToCohort(date: string): string {
  if (!date) return 'Spring 2026';
  const d = new Date(date);
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  if (m <= 2) return `Winter ${y}`;
  if (m <= 5) return `Spring ${y}`;
  if (m <= 8) return `Summer ${y}`;
  return `Fall ${y}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const programFilter = searchParams.get('program');
    const cohortFilter  = searchParams.get('cohort');

    // --- Live Airtable data ---
    const records = await getAllRecords(NPS_TABLE);
    const liveResponses: NormalizedResponse[] = records
      .map(r => {
        const surveyName = lookup(r.fields[PRODUCT_FIELD]);
        const prog = matchProgram(surveyName);
        if (!prog) return null;
        const score = Number(r.fields[SCORE_FIELD]);
        if (isNaN(score) || score < 0 || score > 10) return null;
        const date = String(r.fields[DATE_FIELD] || '');
        const comment = String(r.fields[COMMENT_FIELD] || '');
        return {
          id: r.id,
          score,
          date,
          cohort: dateToCohort(date),
          programId: prog.id,
          programLabel: prog.label,
          comment,
          respondent: String(r.fields[RESPONDENT_FIELD] || ''),
          source: 'live' as const,
          courseRating:    Number(r.fields['Course Rating'])    || 0,
          presenterRating: Number(r.fields['Presenter Rating']) || 0,
          materialsRating: Number(r.fields['Materials Rating']) || 0,
          themes: extractThemes(comment),
        };
      })
      .filter(Boolean) as NormalizedResponse[];

    // --- Historical data ---
    type HistRow = { cohort: string; program: string; score: number; date: string | null; comment: string; respondent: string; source: string };
    const histResponses: NormalizedResponse[] = (historicalData as HistRow[])
      .map((r, i) => {
        const prog = matchProgramByLabel(r.program);
        if (!prog || r.score < 0 || r.score > 10) return null;
        return {
          id: `hist-${i}`,
          score: r.score,
          date: r.date || '',
          cohort: r.cohort,
          programId: prog.id,
          programLabel: prog.label,
          comment: r.comment || '',
          respondent: r.respondent || '',
          source: 'historical' as const,
          themes: extractThemes(r.comment || ''),
        };
      })
      .filter(Boolean) as NormalizedResponse[];

    const allResponses = [...histResponses, ...liveResponses];

    // --- Filter ---
    const filtered = allResponses
      .filter(r => !programFilter || r.programId === programFilter)
      .filter(r => !cohortFilter  || r.cohort    === cohortFilter);

    // --- Overall summary ---
    const summary = calculateNPS(filtered.map(r => r.score));

    // --- Per-program breakdown ---
    const byProgram = CERT_PROGRAMS
      .map(prog => {
        const rs = allResponses.filter(r => r.programId === prog.id);
        if (!rs.length) return null;
        const nps = calculateNPS(rs.map(r => r.score));
        return {
          id: prog.id, label: prog.label, hex: prog.hex, color: prog.color,
          npsScore: nps.score,
          promoterPct: nps.promoterPct, passivePct: nps.passivePct, detractorPct: nps.detractorPct,
          totalResponses: nps.totalResponses,
          avgCourseRating:    rs.filter(r=>r.courseRating).length ? +(rs.reduce((s,r)=>s+(r.courseRating||0),0)/rs.filter(r=>r.courseRating).length).toFixed(1) : 0,
          avgPresenterRating: rs.filter(r=>r.presenterRating).length ? +(rs.reduce((s,r)=>s+(r.presenterRating||0),0)/rs.filter(r=>r.presenterRating).length).toFixed(1) : 0,
          avgMaterialsRating: rs.filter(r=>r.materialsRating).length ? +(rs.reduce((s,r)=>s+(r.materialsRating||0),0)/rs.filter(r=>r.materialsRating).length).toFixed(1) : 0,
        };
      })
      .filter(Boolean);

    // --- Trend: NPS per cohort (filtered by program if set) ---
    const cohortData = COHORT_ORDER
      .map(cohort => {
        const rs = filtered.filter(r => r.cohort === cohort);
        if (!rs.length) return null;
        const nps = calculateNPS(rs.map(r => r.score));
        return { period: cohort, score: nps.score, responses: rs.length };
      })
      .filter(Boolean) as { period: string; score: number; responses: number }[];

    // --- Trend by program (for sparklines) ---
    const trendByProgram = CERT_PROGRAMS
      .filter(prog => !programFilter || prog.id === programFilter)
      .map(prog => ({
        id: prog.id,
        label: prog.label,
        hex: prog.hex,
        trend: COHORT_ORDER
          .map(cohort => {
            const rs = allResponses.filter(r => r.programId === prog.id && r.cohort === cohort);
            if (!rs.length) return null;
            return { period: cohort, score: calculateNPS(rs.map(r=>r.score)).score, responses: rs.length };
          })
          .filter(Boolean),
      }));

    // --- Score distribution ---
    const distribution = Array.from({ length: 10 }, (_, i) => ({
      score: i + 1,
      count: filtered.filter(r => r.score === i + 1).length,
    }));

    // --- Theme analysis ---
    const promoterRs  = filtered.filter(r => r.score >= 9 && r.comment.length > 10);
    const detractorRs = filtered.filter(r => r.score <= 6 && r.comment.length > 10);
    const themeAnalysis = THEMES.map(theme => ({
      id:           theme.id,
      label:        theme.label,
      total:        filtered.filter(r => r.themes.includes(theme.id)).length,
      promoterHits: promoterRs.filter(r => r.themes.includes(theme.id)).length,
      detractorHits: detractorRs.filter(r => r.themes.includes(theme.id)).length,
      pct:          filtered.length ? Math.round((filtered.filter(r=>r.themes.includes(theme.id)).length/filtered.length)*100) : 0,
    })).filter(t => t.total > 0).sort((a,b) => b.total - a.total);

    // --- Available cohorts for filter ---
    const cohorts = [...new Set(allResponses.map(r => r.cohort))]
      .sort((a,b) => COHORT_ORDER.indexOf(a) - COHORT_ORDER.indexOf(b));

    return NextResponse.json({
      summary,
      byProgram,
      trend: cohortData,
      trendByProgram,
      distribution,
      themeAnalysis,
      cohorts,
      totalHistorical: histResponses.length,
      totalLive:       liveResponses.length,
      responses: filtered.map(r => ({
        id: r.id, score: r.score, date: r.date, cohort: r.cohort,
        programLabel: r.programLabel, comment: r.comment,
        respondent: r.respondent, source: r.source, themes: r.themes,
      })),
      promoterComments:  promoterRs.map(r=>({ comment:r.comment, program:r.programLabel, cohort:r.cohort, respondent:r.respondent })),
      detractorComments: detractorRs.map(r=>({ comment:r.comment, program:r.programLabel, cohort:r.cohort, respondent:r.respondent })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[/api/certificates]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
