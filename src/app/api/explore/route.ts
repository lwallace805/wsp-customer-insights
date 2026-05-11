import { NextResponse } from 'next/server';
import { listTables, getSampleRecords } from '@/lib/airtable';

export async function GET() {
  try {
    const tables = await listTables();
    const result = await Promise.all(
      tables.map(async (table) => {
        const samples = await getSampleRecords(table.name, 3);
        return {
          id: table.id,
          name: table.name,
          fields: table.fields,
          sampleRecords: samples.map(r => r.fields),
        };
      })
    );
    return NextResponse.json({ tables: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
