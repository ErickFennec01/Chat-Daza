import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const allowedRoots = new Set(['agentes', 'conhecimento', 'perguntas-sem-resposta', 'conversas', 'metricas', 'canais', 'operacao', 'roteiros', 'laboratorio']);

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const apiUrl = process.env.API_INTERNAL_URL;
  const session = (await cookies()).get('daza_session')?.value;
  if (!apiUrl) return NextResponse.json({ message: 'API interna indisponível.' }, { status: 503 });
  if (!session) return NextResponse.json({ message: 'Sessão ausente.' }, { status: 401 });
  if (!path.length || !allowedRoots.has(path[0]) || !path.every((part) => /^[a-z0-9-]+$/.test(part))) return NextResponse.json({ message: 'Rota não permitida.' }, { status: 404 });
  const headers = new Headers({ authorization: `Bearer ${session}` });
  if (request.headers.get('content-type')?.includes('application/json')) headers.set('content-type', 'application/json');
  const method = request.method;
  const body = method === 'GET' || method === 'DELETE' ? undefined : await request.text();
  try {
    const upstream = await fetch(`${apiUrl}/v1/${path.join('/')}`, { method, headers, body, cache: 'no-store' });
    const responseBody = await upstream.arrayBuffer();
    const response = new NextResponse(responseBody, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store' } });
    if (upstream.status === 401) response.cookies.set('daza_session', '', { httpOnly: true, secure: process.env.SESSION_COOKIE_SECURE === 'true', sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  } catch { return NextResponse.json({ message: 'API interna indisponível.' }, { status: 503 }); }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
