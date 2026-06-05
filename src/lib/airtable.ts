import Airtable from 'airtable';
import { isDemo } from '@/lib/demo/flag';

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID!);

export type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

// In demo mode, serve synthetic records instead of hitting Airtable.
// Matches on the table name (env override or the route defaults).
async function getDemoRecords(tableName: string): Promise<AirtableRecord[]> {
  const npsTable    = process.env.NPS_TABLE_NAME    || 'Course Survey Results';
  const surveyTable = process.env.SURVEY_TABLE_NAME || 'SurveyMonkey Surveys';
  const { generateNpsRecords, generateSurveyRecords } = await import('@/lib/demo/npsData');
  if (tableName === npsTable) return generateNpsRecords();
  if (tableName === surveyTable) return generateSurveyRecords();
  return []; // other tables (e.g. creative comments) — empty in demo
}

async function fetchAllRecords(tableName: string, options: Airtable.SelectOptions<Record<string, unknown>> = {}): Promise<AirtableRecord[]> {
  return new Promise((resolve, reject) => {
    const records: AirtableRecord[] = [];
    base(tableName).select(options).eachPage(
      (page, next) => {
        page.forEach(r => records.push({ id: r.id, fields: r.fields as Record<string, unknown> }));
        next();
      },
      (err) => {
        if (err) reject(new Error(String(err)));
        else resolve(records);
      }
    );
  });
}

export async function listTables(): Promise<{ id: string; name: string; fields: { name: string; type: string }[] }[]> {
  const res = await fetch(
    `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
    { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` }, cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`Airtable meta API error: ${res.status}`);
  const data = await res.json();
  return data.tables;
}

export async function getSampleRecords(tableName: string, limit = 5): Promise<AirtableRecord[]> {
  return fetchAllRecords(tableName, { maxRecords: limit });
}

export async function getAllRecords(tableName: string, filterFormula?: string): Promise<AirtableRecord[]> {
  if (isDemo()) return getDemoRecords(tableName);
  return fetchAllRecords(tableName, filterFormula ? { filterByFormula: filterFormula } : {});
}

export { base };
