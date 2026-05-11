import { NextRequest, NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/airtable';
import { calculateNPS, groupByPeriod } from '@/lib/nps';

// Update these to match your actual Airtable field names after running /explore
const NPS_TABLE = process.env.NPS_TABLE_NAME || 'NPS';
const SCORE_FIELD = process.env.NPS_SCORE_FIELD || 'Score';
const DATE_FIELD = process.env.NPS_DATE_FIELD || 'Date';
const PRODUCT_FIELD = process.env.NPS_PRODUCT_FIELD || 'Product';
const COMMENT_FIELD = process.env.NPS_COMMENT_FIELD || 'Comment';
const RESPONDENT_FIELD = process.env.NPS_RESPONDENT_FIELD || 'Name';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const product = searchParams.get('product');
    const period = (searchParams.get('period') as 'month' | 'quarter') || 'month';

    const records = await getAllRecords(NPS_TABLE);

    const parsed = records
      .map(r => ({
        id: r.id,
        score: Number(r.fields[SCORE_FIELD]),
        date: String(r.fields[DATE_FIELD] || ''),
        product: String(r.fields[PRODUCT_FIELD] || 'Unknown'),
        comment: String(r.fields[COMMENT_FIELD] || ''),
        respondent: String(r.fields[RESPONDENT_FIELD] || ''),
      }))
      .filter(r => !isNaN(r.score) && r.score >= 0 && r.score <= 10);

    const filtered = product ? parsed.filter(r => r.product === product) : parsed;

    const summary = calculateNPS(filtered.map(r => r.score));
    const trend = groupByPeriod(
      filtered.filter(r => r.date).map(r => ({ date: r.date, score: r.score })),
      period
    );
    const products = [...new Set(parsed.map(r => r.product))].sort();

    return NextResponse.json({ summary, trend, responses: filtered, products });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
