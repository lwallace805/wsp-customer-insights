import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const COMMENTS_FILE = path.join(process.cwd(), 'src/data/creativeComments.json');

type Comment = {
  id: string;
  adId: string; // "{programId}/{batchId}/{adNumber}"
  author: string;
  text: string;
  createdAt: string;
};

function readComments(): Comment[] {
  try {
    return JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeComments(comments: Comment[]) {
  fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2));
}

export async function GET(req: NextRequest) {
  const adId = req.nextUrl.searchParams.get('adId');
  const comments = readComments();
  const filtered = adId ? comments.filter(c => c.adId === adId) : comments;
  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { adId, author, text } = body as { adId: string; author: string; text: string };

  if (!adId || !text?.trim()) {
    return NextResponse.json({ error: 'adId and text required' }, { status: 400 });
  }

  const comments = readComments();
  const comment: Comment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    adId,
    author: author?.trim() || 'Anonymous',
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  comments.push(comment);
  writeComments(comments);

  return NextResponse.json(comment, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const comments = readComments().filter(c => c.id !== id);
  writeComments(comments);
  return NextResponse.json({ ok: true });
}
