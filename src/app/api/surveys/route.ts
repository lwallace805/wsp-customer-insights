import { NextRequest, NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/airtable';

// Update these after running /explore to match your actual Airtable field names
const SURVEY_TABLE = process.env.SURVEY_TABLE_NAME || 'Survey Responses';
const DATE_FIELD = process.env.SURVEY_DATE_FIELD || 'Date';
const PRODUCT_FIELD = process.env.SURVEY_PRODUCT_FIELD || 'Product';
const RESPONDENT_FIELD = process.env.SURVEY_RESPONDENT_FIELD || 'Name';
const SOURCE_FIELD = process.env.SURVEY_SOURCE_FIELD || 'Source';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const product = searchParams.get('product');
    const source = searchParams.get('source');

    const records = await getAllRecords(SURVEY_TABLE);

    const parsed = records.map(r => ({
      id: r.id,
      date: String(r.fields[DATE_FIELD] || ''),
      product: String(r.fields[PRODUCT_FIELD] || 'Unknown'),
      respondent: String(r.fields[RESPONDENT_FIELD] || ''),
      source: String(r.fields[SOURCE_FIELD] || 'SurveyMonkey'),
      // All remaining fields as raw answers
      answers: Object.fromEntries(
        Object.entries(r.fields).filter(
          ([key]) => ![DATE_FIELD, PRODUCT_FIELD, RESPONDENT_FIELD, SOURCE_FIELD].includes(key)
        )
      ),
    }));

    const filtered = parsed
      .filter(r => !product || r.product === product)
      .filter(r => !source || r.source === source);

    const products = [...new Set(parsed.map(r => r.product))].sort();
    const sources = [...new Set(parsed.map(r => r.source))].sort();

    return NextResponse.json({ responses: filtered, products, sources, total: filtered.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
