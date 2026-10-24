import { afterEach, beforeEach, describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { WahaService } from './waha.service';

const originalFetch = globalThis.fetch;

describe('WahaService', () => {
  beforeEach(() => {
    process.env.WAHA_BASE_URL = 'http://waha.test';
    process.env.WAHA_API_KEY = 'chave-de-teste';
  });

  afterEach(() => { globalThis.fetch = originalFetch; });

  it('trata criação repetida de sessão como idempotente', async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (url: string | URL) => {
      calls.push(String(url));
      return new Response('{}', { status: String(url).endsWith('/start') ? 201 : 422 });
    }) as typeof fetch;

    await new WahaService().startSession('empresa-suporte');

    assert.deepEqual(calls, ['http://waha.test/api/sessions', 'http://waha.test/api/sessions/empresa-suporte/start']);
  });

  it('normaliza telefone e envia somente pelo endpoint interno do WAHA', async () => {
    let request: { url: string; body: unknown } | undefined;
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      request = { url: String(url), body: JSON.parse(String(init?.body)) };
      return new Response(JSON.stringify({ id: 'provider-id' }), { status: 200 });
    }) as typeof fetch;

    const result = await new WahaService().sendText('empresa-suporte', '+55 (11) 99999-9999', 'Olá');

    assert.equal(result, 'provider-id');
    assert.deepEqual(request, { url: 'http://waha.test/api/sendText', body: { session: 'empresa-suporte', chatId: '5511999999999@c.us', text: 'Olá' } });
  });

  it('não chama provedor para telefone inválido', async () => {
    globalThis.fetch = (async () => { throw new Error('não deveria chamar'); }) as typeof fetch;

    await assert.rejects(() => new WahaService().sendText('empresa-suporte', '123', 'Olá'), { message: 'Contato WhatsApp inválido para entrega WAHA' });
  });

  it('traduz os estados do WAHA sem revelar dados da conta vinculada', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ status: 'WORKING', me: { id: '5511999999999@c.us' } }), { status: 200 })) as typeof fetch;

    const status = await new WahaService().getSessionStatus('empresa-suporte');

    assert.deepEqual(status, { estado: 'conectado', statusWaha: 'WORKING' });
  });
});
