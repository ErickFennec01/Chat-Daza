import { NextResponse } from 'next/server';

const apiUrl = process.env.API_INTERNAL_URL;

export async function POST(request: Request) {
  if (!apiUrl) return NextResponse.json({ message: 'Serviço de autenticação indisponível.' }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== 'string' || typeof body.senha !== 'string') return NextResponse.json({ message: 'Dados de acesso inválidos.' }, { status: 400 });
  try {
    const upstream = await fetch(`${apiUrl}/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: body.email, senha: body.senha }), cache: 'no-store' });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok || typeof result.accessToken !== 'string') return NextResponse.json({ message: result.message ?? 'Não foi possível entrar.' }, { status: upstream.status || 401 });
    const response = NextResponse.json({ usuario: result.usuario });
    response.cookies.set('daza_session', result.accessToken, { httpOnly: true, secure: process.env.SESSION_COOKIE_SECURE === 'true', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
    return response;
  } catch { return NextResponse.json({ message: 'Serviço de autenticação indisponível.' }, { status: 503 }); }
}
