import { NextRequest, NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/airtable';

const SURVEY_TABLE       = process.env.SURVEY_TABLE_NAME       || 'SurveyMonkey Surveys';
const DATE_FIELD         = process.env.SURVEY_DATE_FIELD       || 'Date';
const PRODUCT_FIELD      = process.env.SURVEY_PRODUCT_FIELD    || 'Survey Name';
const TYPE_FIELD         = process.env.SURVEY_TYPE_FIELD       || 'Survey Type';
const REGION_FIELD       = process.env.SURVEY_REGION_FIELD     || 'Region';
const CLIENT_TYPE_FIELD  = process.env.SURVEY_CLIENT_TYPE_FIELD || 'Client Type';

function lookup(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value ?? '');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const product    = searchParams.get('product');
    const surveyType = searchParams.get('type');
    const region     = searchParams.get('region');

    const records = await getAllRecords(SURVEY_TABLE);

    const parsed = records.map(r => ({
      id:           r.id,
      name:         String(r.fields[PRODUCT_FIELD] || ''),
      date:         lookup(r.fields[DATE_FIELD]),
      surveyType:   String(r.fields[TYPE_FIELD] || ''),
      region:       lookup(r.fields[REGION_FIELD]),
      clientType:   lookup(r.fields[CLIENT_TYPE_FIELD]),
      npsScore:     r.fields['NPS Score'] != null ? Number(r.fields['NPS Score']) : null,
      courseRating: r.fields['Course Rating'] != null ? Number(r.fields['Course Rating']) : null,
      presenterRating: r.fields['Presenter Rating'] != null ? Number(r.fields['Presenter Rating']) : null,
      relevanceRating: r.fields['Relevance Rating'] != null ? Number(r.fields['Relevance Rating']) : null,
      materialsRating: r.fields['Materials Rating'] != null ? Number(r.fields['Materials Rating']) : null,
      numResponses: Number(r.fields['# Responses'] || 0),
      promoters:    Number(r.fields['Promoters']   || 0),
      detractors:   Number(r.fields['Detractors']  || 0),
      executiveSummary: String(r.fields['Executive Summary'] || ''),
      surveyUrl:    String(r.fields['Survey URL'] || ''),
    }));

    const filtered = parsed
      .filter(r => !product    || r.name       === product)
      .filter(r => !surveyType || r.surveyType === surveyType)
      .filter(r => !region     || r.region     === region);

    const products     = [...new Set(parsed.map(r => r.name).filter(Boolean))].sort();
    const surveyTypes  = [...new Set(parsed.map(r => r.surveyType).filter(Boolean))].sort();
    const regions      = [...new Set(parsed.map(r => r.region).filter(Boolean))].sort();

    return NextResponse.json({ surveys: filtered, products, surveyTypes, regions, total: filtered.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
