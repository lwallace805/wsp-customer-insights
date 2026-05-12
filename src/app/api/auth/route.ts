import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { password, from } = await request.json();
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const redirectTo = (from && from !== '/login') ? from : '/';
  const response = NextResponse.json({ ok: true, redirect: redirectTo });

  response.cookies.set('dash_auth', expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
