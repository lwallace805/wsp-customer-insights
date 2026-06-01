import { NextRequest, NextResponse } from 'next/server';
import { base } from '@/lib/airtable';

const TABLE = process.env.CREATIVE_COMMENTS_TABLE_NAME || 'Creative Review Comments';

type Comment = {
  id: string;
  adId: string;
  author: string;
  text: string;
  createdAt: string;
};

function toComment(record: { id: string; fields: Record<string, unknown> }): Comment {
  return {
    id: record.id,
    adId: String(record.fields['Ad ID'] ?? ''),
    author: String(record.fields['Author'] ?? 'Anonymous'),
    text: String(record.fields['Comment'] ?? ''),
    createdAt: String(record.fields['Created At'] ?? new Date().toISOString()),
  };
}

export async function GET(req: NextRequest) {
  const adId = req.nextUrl.searchParams.get('adId');
  try {
    const formula = adId ? `{Ad ID} = "${adId}"` : '';
    const results: Comment[] = [];
    await new Promise<void>((resolve, reject) => {
      base(TABLE)
        .select({
          ...(formula ? { filterByFormula: formula } : {}),
          sort: [{ field: 'Created At', direction: 'asc' }],
        })
        .eachPage(
          (page, next) => {
            page.forEach(r =>
              results.push(toComment({ id: r.id, fields: r.fields as Record<string, unknown> }))
            );
            next();
          },
          err => { if (err) reject(err); else resolve(); }
        );
    });
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const { adId, author, text } = (await req.json()) as {
    adId: string;
    author: string;
    text: string;
  };

  if (!adId || !text?.trim()) {
    return NextResponse.json({ error: 'adId and text required' }, { status: 400 });
  }

  try {
    const created = await base(TABLE).create({
      'Ad ID': adId,
      'Author': author?.trim() || 'Anonymous',
      'Comment': text.trim(),
      'Created At': new Date().toISOString(),
    });
    return NextResponse.json(
      toComment({ id: created.id, fields: created.fields as Record<string, unknown> }),
      { status: 201 }
    );
  } catch (err) {
    console.error('Airtable comment error:', err);
    return NextResponse.json({ error: 'Failed to save comment' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    await base(TABLE).destroy(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
