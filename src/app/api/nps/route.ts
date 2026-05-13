import { NextRequest, NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/airtable';
import { calculateNPS, groupByPeriod } from '@/lib/nps';

const NPS_TABLE       = process.env.NPS_TABLE_NAME       || 'Course Survey Results';
const SCORE_FIELD     = process.env.NPS_SCORE_FIELD      || 'Recommend Likelihood (Number)';
const DATE_FIELD      = process.env.NPS_DATE_FIELD       || 'Response Date';
const COMMENT_FIELD   = process.env.NPS_COMMENT_FIELD    || 'Recommendation Reasoning';
const RESPONDENT_FIELD = process.env.NPS_RESPONDENT_FIELD || 'Name';
const PRODUCT_FIELD   = process.env.NPS_PRODUCT_FIELD    || 'Survey Name';
const REGION_FIELD    = process.env.NPS_REGION_FIELD     || 'Region';
const CLIENT_TYPE_FIELD = process.env.NPS_CLIENT_TYPE_FIELD || 'Client Type';

// Lookup fields in Airtable return arrays — this safely extracts a string value
function lookup(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value ?? '');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const product    = searchParams.get('product');
    const region     = searchParams.get('region');
    const clientType = searchParams.get('clientType');
    const period     = (searchParams.get('period') as 'month' | 'quarter') || 'month';

    const records = await getAllRecords(NPS_TABLE);

    const parsed = records
      .map(r => ({
        id:         r.id,
        score:      Number(r.fields[SCORE_FIELD]),
        date:       String(r.fields[DATE_FIELD] || ''),
        product:    lookup(r.fields[PRODUCT_FIELD]),
        comment:    String(r.fields[COMMENT_FIELD] || ''),
        respondent: String(r.fields[RESPONDENT_FIELD] || ''),
        region:     lookup(r.fields[REGION_FIELD]),
        clientType: lookup(r.fields[CLIENT_TYPE_FIELD]),
        // Extra ratings from Course Survey Results
        courseRating:     Number(r.fields['Course Rating'])    || 0,
        presenterRating:  Number(r.fields['Presenter Rating']) || 0,
        relevanceRating:  Number(r.fields['Relevance'])        || 0,
        materialsRating:  Number(r.fields['Materials Rating']) || 0,
      }))
      .filter(r => !isNaN(r.score) && r.score >= 0 && r.score <= 10);

    const filtered = parsed
      .filter(r => !product    || r.product    === product)
      .filter(r => !region     || r.region     === region)
      .filter(r => !clientType || r.clientType === clientType);

    const summary = calculateNPS(filtered.map(r => r.score));
    const trend   = groupByPeriod(
      filtered.filter(r => r.date).map(r => ({ date: r.date, score: r.score })),
      period
    );

    // Unique filter options
    const products    = [...new Set(parsed.map(r => r.product).filter(Boolean))].sort();
    const regions     = [...new Set(parsed.map(r => r.region).filter(Boolean))].sort();
    const clientTypes = [...new Set(parsed.map(r => r.clientType).filter(Boolean))].sort();

    // Average ratings across filtered responses
    const avgRatings = filtered.length ? {
      course:    +(filtered.reduce((s, r) => s + r.courseRating, 0)    / filtered.filter(r => r.courseRating).length || 0).toFixed(1),
      presenter: +(filtered.reduce((s, r) => s + r.presenterRating, 0) / filtered.filter(r => r.presenterRating).length || 0).toFixed(1),
      relevance: +(filtered.reduce((s, r) => s + r.relevanceRating, 0) / filtered.filter(r => r.relevanceRating).length || 0).toFixed(1),
      materials: +(filtered.reduce((s, r) => s + r.materialsRating, 0) / filtered.filter(r => r.materialsRating).length || 0).toFixed(1),
    } : null;

    return NextResponse.json({ summary, trend, responses: filtered, products, regions, clientTypes, avgRatings });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[/api/nps]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
