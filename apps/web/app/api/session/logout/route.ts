import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ encerrada: true });
  response.cookies.set('daza_session', '', { httpOnly: true, secure: process.env.SESSION_COOKIE_SECURE === 'true', sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
