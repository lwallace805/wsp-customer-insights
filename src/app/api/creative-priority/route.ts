import { NextRequest, NextResponse } from 'next/server';
import { getBase } from '@/lib/airtable';
import type { TestingPriority } from '@/data/creativeReviews';

const TABLE = process.env.CREATIVE_PRIORITY_TABLE_NAME || 'Creative Priority Overrides';

// ── GET /api/creative-priority ───────────────────────────────────────────────
// Returns all overrides as { overrides: Record<adId, priority> }
export async function GET() {
  try {
    const overrides: Record<string, TestingPriority> = {};
    await new Promise<void>((resolve, reject) => {
      getBase()(TABLE)
        .select()
        .eachPage(
          (page, next) => {
            page.forEach(r => {
              const adId    = String(r.fields['Ad ID']   ?? '');
              const priority = String(r.fields['Priority'] ?? '');
              if (adId && priority) overrides[adId] = priority as TestingPriority;
            });
            next();
          },
          err => { if (err) reject(err); else resolve(); }
        );
    });
    return NextResponse.json({ overrides });
  } catch {
    // Return empty overrides on error — page falls back to static defaults
    return NextResponse.json({ overrides: {} });
  }
}

// ── POST /api/creative-priority ──────────────────────────────────────────────
// Body: { adId: string, priority: TestingPriority }
// Upserts: updates the existing record for this adId, or creates one.
export async function POST(req: NextRequest) {
  let body: { adId?: string; priority?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { adId, priority } = body;
  if (!adId || !priority) {
    return NextResponse.json({ error: 'adId and priority are required' }, { status: 400 });
  }

  const VALID: TestingPriority[] = ['first', 'second', 'third', 'archived'];
  if (!VALID.includes(priority as TestingPriority)) {
    return NextResponse.json({ error: `priority must be one of: ${VALID.join(', ')}` }, { status: 400 });
  }

  try {
    const base = getBase();

    // Look for an existing record with this Ad ID
    const existing: string[] = [];
    await new Promise<void>((resolve, reject) => {
      base(TABLE)
        .select({ filterByFormula: `{Ad ID} = "${adId.replace(/"/g, '\\"')}"`, maxRecords: 1 })
        .eachPage(
          (page, next) => { page.forEach(r => existing.push(r.id)); next(); },
          err => { if (err) reject(err); else resolve(); }
        );
    });

    if (existing.length > 0) {
      await base(TABLE).update(existing[0], { 'Ad ID': adId, 'Priority': priority });
    } else {
      await base(TABLE).create({ 'Ad ID': adId, 'Priority': priority });
    }

    return NextResponse.json({ ok: true, adId, priority });
  } catch (err) {
    console.error('[/api/creative-priority] error:', err);
    return NextResponse.json({ error: 'Failed to save priority' }, { status: 500 });
  }
}
