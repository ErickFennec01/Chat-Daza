import { after, before, describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppController } from './platform.controller';
import { AppService } from './platform.service';
import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';
import { TenantGuard } from './tenant.guard';

const empresaId = '11111111-1111-4111-8111-111111111111';
let baseUrl = '';
let app: INestApplication;
let controller: AppController;
let agentWrites = 0;
let resolvedWahaSessions: string[] = [];
let humanMessages: Array<{ tenant: string; conversationId: string; usuarioId: string; conteudo: string }> = [];

describe('API HTTP: validação e autorização', () => {
  before(async () => {
    const service = {
      upsertAgent: async (tenant: string) => { agentWrites += 1; return { id: '33333333-3333-4333-8333-333333333333', empresaId: tenant }; },
      health: async () => ({ status: 'ok' }),
      resolveWahaChannel: async (session: string) => { resolvedWahaSessions.push(session); return { canal_id: '44444444-4444-4444-8444-444444444444', agente_id: '33333333-3333-4333-8333-333333333333' }; },
      getWhatsAppChannelStatus: async () => ({ sessao: 'empresa-suporte', estado: 'aguardando_qr', statusWaha: 'SCAN_QR_CODE' }),
      sendHumanMessage: async (tenant: string, conversationId: string, usuarioId: string, conteudo: string) => { humanMessages.push({ tenant, conversationId, usuarioId, conteudo }); return { aceita: true, statusEntrega: 'enviada' }; },
    };
    const auth = {
      verifySession: (token: string) => {
        if (token === 'admin') return { usuarioId: 'u-admin', empresaId, nome: 'Admin', email: 'admin@empresa.test', papel: 'admin' as const };
        if (token === 'operador') return { usuarioId: 'u-operador', empresaId, nome: 'Operador', email: 'operador@empresa.test', papel: 'operador' as const };
        throw new Error('token inválido');
      },
      login: async () => { throw new Error('não usado'); },
    };
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [TenantGuard, { provide: AppService, useValue: service }, { provide: AuthService, useValue: auth }, { provide: DatabaseService, useValue: { query: async () => ({ rows: [] }) } }],
    }).compile();
    controller = module.get(AppController);
    app = module.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    process.env.WAHA_WEBHOOK_SECRET = 'webhook-test-secret';
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  after(async () => { await app.close(); });

  it('rejeita escrita sem token', async () => {
    const response = await fetch(`${baseUrl}/v1/agentes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
    assert.equal(response.status, 401);
  });

  it('rejeita alteração de operador mesmo que o frontend envie o payload válido', async () => {
    const response = await fetch(`${baseUrl}/v1/agentes`, { method: 'POST', headers: { authorization: 'Bearer operador', 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Agente', systemPrompt: 'Atenda bem', modelo: 'modelo/teste', temperatura: 0.2, limiteRespostaTokens: 300, limiarConfianca: 0.7 }) });
    assert.equal(response.status, 403);
    assert.equal(agentWrites, 0);
  });

  it('valida o payload no backend antes de chamar regra de negócio', async () => {
    const response = await fetch(`${baseUrl}/v1/agentes`, { method: 'POST', headers: { authorization: 'Bearer admin', 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'x', systemPrompt: 'Atenda bem', modelo: 'modelo/teste', temperatura: 4, limiteRespostaTokens: 2, limiarConfianca: 4, empresaId: 'tentativa-de-forjar-tenant' }) });
    assert.equal(response.status, 400);
    assert.equal(agentWrites, 0);
  });

  it('aceita administrador e usa a empresa derivada do token', async () => {
    const response = await fetch(`${baseUrl}/v1/agentes`, { method: 'POST', headers: { authorization: 'Bearer admin', 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Agente', systemPrompt: 'Atenda bem', modelo: 'modelo/teste', temperatura: 0.2, limiteRespostaTokens: 300, limiarConfianca: 0.7 }) });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).empresaId, empresaId);
    assert.equal(agentWrites, 1);
  });

  it('envia mensagem humana com a identidade da sessão, nunca do payload', async () => {
    humanMessages = [];
    const response = await fetch(`${baseUrl}/v1/conversas/33333333-3333-4333-8333-333333333333/mensagens`, { method: 'POST', headers: { authorization: 'Bearer operador', 'content-type': 'application/json' }, body: JSON.stringify({ conteudo: 'Mensagem do atendente' }) });
    assert.equal(response.status, 201);
    assert.deepEqual(humanMessages, [{ tenant: empresaId, conversationId: '33333333-3333-4333-8333-333333333333', usuarioId: 'u-operador', conteudo: 'Mensagem do atendente' }]);

    const forged = await fetch(`${baseUrl}/v1/conversas/33333333-3333-4333-8333-333333333333/mensagens`, { method: 'POST', headers: { authorization: 'Bearer operador', 'content-type': 'application/json' }, body: JSON.stringify({ conteudo: 'Tentativa inválida', usuarioId: 'tentativa-de-forjar-operador' }) });
    assert.equal(forged.status, 400);
    assert.equal(humanMessages.length, 1);
  });

  it('rejeita mensagem humana vazia antes de acionar a entrega', async () => {
    humanMessages = [];
    const response = await fetch(`${baseUrl}/v1/conversas/33333333-3333-4333-8333-333333333333/mensagens`, { method: 'POST', headers: { authorization: 'Bearer operador', 'content-type': 'application/json' }, body: JSON.stringify({ conteudo: '' }) });
    assert.equal(response.status, 400);
    assert.equal(humanMessages.length, 0);
  });

  it('não permite que operador consulte estado operacional do canal', async () => {
    const response = await fetch(`${baseUrl}/v1/canais/whatsapp/33333333-3333-4333-8333-333333333333/status`, { headers: { authorization: 'Bearer operador' } });
    assert.equal(response.status, 403);
  });

  it('aceita identificador LID de mensagem recebida e resolve o canal', async () => {
    resolvedWahaSessions = [];
    const response = await fetch(`${baseUrl}/v1/webhooks/waha/whatsapp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-daza-waha-webhook': 'webhook-test-secret' },
      body: JSON.stringify({ event: 'message', session: 'empresa-suporte', payload: { id: 'false_123@lid_ABC', from: '123456789@lid', body: 'Olá', fromMe: false } }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(resolvedWahaSessions, ['empresa-suporte']);
  });

  it('aceita fromMe textual falso sem tratar a mensagem recebida como própria', async () => {
    resolvedWahaSessions = [];
    const response = await fetch(`${baseUrl}/v1/webhooks/waha/whatsapp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-daza-waha-webhook': 'webhook-test-secret' },
      body: JSON.stringify({ event: 'message', session: 'empresa-suporte', payload: { id: 'false_123@lid_DEF', from: '123456789@lid', body: 'Teste', fromMe: 'false' } }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(resolvedWahaSessions, ['empresa-suporte']);
  });

  it('envia eventos internos ao n8n com a chave configurada', async () => {
    const fetchOriginal = globalThis.fetch;
    const urlOriginal = process.env.N8N_AGENT_WEBHOOK_URL;
    const secretOriginal = process.env.N8N_WEBHOOK_SECRET;
    let chamada: { url: string; chave: string | null } | undefined;
    process.env.N8N_AGENT_WEBHOOK_URL = 'http://n8n.test/webhook/daza/atendimento/inbound';
    process.env.N8N_WEBHOOK_SECRET = 'chave-interna-de-teste';
    globalThis.fetch = (async (url, init) => {
      chamada = { url: String(url), chave: new Headers(init?.headers).get('x-daza-internal-key') };
      return new Response('', { status: 404 });
    }) as typeof fetch;
    try {
      await (controller as unknown as { dispatchToN8n: (evento: Record<string, unknown>) => Promise<void> }).dispatchToN8n({ canal: 'whatsapp' });
      assert.deepEqual(chamada, { url: 'http://n8n.test/webhook/daza/atendimento/inbound', chave: 'chave-interna-de-teste' });
    } finally {
      globalThis.fetch = fetchOriginal;
      if (urlOriginal === undefined) delete process.env.N8N_AGENT_WEBHOOK_URL;
      else process.env.N8N_AGENT_WEBHOOK_URL = urlOriginal;
      if (secretOriginal === undefined) delete process.env.N8N_WEBHOOK_SECRET;
      else process.env.N8N_WEBHOOK_SECRET = secretOriginal;
    }
  });
});
