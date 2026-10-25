import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { AppService } from './platform.service';

const empresaId = '11111111-1111-4111-8111-111111111111';
const agenteId = '22222222-2222-4222-8222-222222222222';

describe('AppService canais WAHA', () => {
  it('cria canal escopado à empresa e sem receber token do navegador', async () => {
    const queries: Array<{ text: string; values: unknown[] }> = [];
    const client = {
      query: async (text: string, values: unknown[] = []) => {
        queries.push({ text, values });
        if (text.includes('select id from atendimento.agentes')) return { rows: [{ id: agenteId }] };
        if (text.includes('insert into atendimento.integracoes_canais')) return { rows: [{ id: '33333333-3333-4333-8333-333333333333' }] };
        return { rows: [{ id: '44444444-4444-4444-8444-444444444444', sessao_waha: 'empresa-suporte', provedor: 'waha' }] };
      },
    };
    const db = { withTenant: async (tenant: string, operation: (value: typeof client) => Promise<unknown>) => { assert.equal(tenant, empresaId); return operation(client); } };
    const service = new AppService(db as never, {} as never, {} as never);

    await service.createWhatsAppChannel(empresaId, { agenteId, sessao: 'empresa-suporte', displayName: 'Suporte' });

    assert.equal(queries.some((query) => query.text.includes("provedor, phone_number_id, sessao_waha") && query.values.includes('empresa-suporte')), true);
    assert.equal(queries.every((query) => !query.text.toLowerCase().includes('access_token')), true);
  });

  it('não cria canal quando o agente não pertence à empresa autenticada', async () => {
    const client = { query: async () => ({ rows: [] }) };
    const db = { withTenant: async (_tenant: string, operation: (value: typeof client) => Promise<unknown>) => operation(client) };
    const service = new AppService(db as never, {} as never, {} as never);

    await assert.rejects(() => service.createWhatsAppChannel(empresaId, { agenteId, sessao: 'empresa-suporte' }), { message: 'Agente ativo não encontrado para a empresa' });
  });

  it('tipa o canal da fila para persistir uma decisão do agente', async () => {
    const queries: string[] = [];
    const client = {
      query: async (text: string) => {
        queries.push(text);
        if (text.includes('registrar_saida')) return { rows: [{ mensagem_id: '33333333-3333-4333-8333-333333333333' }] };
        if (text.includes("select canal, contato_externo")) return { rows: [{ canal: 'whatsapp', contato_externo: '10000000000@c.us', canal_id: '44444444-4444-4444-8444-444444444444' }] };
        if (text.includes("select id, provedor from atendimento.canais_whatsapp where id")) return { rows: [{ id: '44444444-4444-4444-8444-444444444444', provedor: 'waha' }] };
        if (text.includes('insert into atendimento.entregas_mensagens')) return { rows: [{ id: '55555555-5555-4555-8555-555555555555' }] };
        if (text.includes("update atendimento.entregas_mensagens set status='processando'")) return { rows: [{ id: '55555555-5555-4555-8555-555555555555', canal_whatsapp_id: '44444444-4444-4444-8444-444444444444', conteudo: 'resposta sintética', contato_externo: '10000000000@c.us' }] };
        if (text.includes('select sessao_waha')) return { rows: [{ sessao_waha: 'sessao-sintetica' }] };
        return { rows: [] };
      },
    };
    const db = { withTenant: async (_tenant: string, operation: (value: typeof client) => Promise<unknown>) => operation(client) };
    const waha = { sendText: async () => 'provedor-sintetico' };
    const service = new AppService(db as never, {} as never, waha as never);

    const result = await service.processAgentDecision({ empresaId, conversaId: '66666666-6666-4666-8666-666666666666', acao: 'responder', resposta: 'resposta sintética', modelo: 'modelo/sintetico' });

    assert.equal(result.statusEntrega, 'enviada');
    assert.equal(queries.some((query) => query.includes('values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text') && query.includes('case when $4::uuid is null')), true);
  });

  it('envia resposta humana somente na conversa assumida pelo próprio usuário', async () => {
    const queries: Array<{ text: string; values: unknown[] }> = [];
    const conversaId = '66666666-6666-4666-8666-666666666666';
    const usuarioId = '77777777-7777-4777-8777-777777777777';
    const client = {
      query: async (text: string, values: unknown[] = []) => {
        queries.push({ text, values });
        if (text.includes("status='aguardando_humano' and atendida_por_usuario_id=$3")) return { rows: [{ canal: 'whatsapp', contato_externo: '10000000000@c.us', canal_id: '44444444-4444-4444-8444-444444444444' }] };
        if (text.includes('registrar_saida')) return { rows: [{ mensagem_id: '33333333-3333-4333-8333-333333333333' }] };
        if (text.includes("select id, provedor from atendimento.canais_whatsapp where id")) return { rows: [{ id: '44444444-4444-4444-8444-444444444444', provedor: 'waha' }] };
        if (text.includes('insert into atendimento.entregas_mensagens')) return { rows: [{ id: '55555555-5555-4555-8555-555555555555' }] };
        if (text.includes("update atendimento.entregas_mensagens set status='processando'")) return { rows: [{ id: '55555555-5555-4555-8555-555555555555', canal_whatsapp_id: '44444444-4444-4444-8444-444444444444', conteudo: 'Olá, como posso ajudar?', contato_externo: '10000000000@c.us' }] };
        if (text.includes('select sessao_waha')) return { rows: [{ sessao_waha: 'sessao-sintetica' }] };
        return { rows: [] };
      },
    };
    const db = { withTenant: async (_tenant: string, operation: (value: typeof client) => Promise<unknown>) => operation(client) };
    const waha = { sendText: async () => 'provedor-sintetico' };
    const service = new AppService(db as never, {} as never, waha as never);

    const result = await service.sendHumanMessage(empresaId, conversaId, usuarioId, '  Olá, como posso ajudar?  ');

    assert.equal(result.statusEntrega, 'enviada');
    assert.equal(queries[0].values[2], usuarioId);
    assert.equal(queries.some((query) => query.values.includes(`humano:${usuarioId}`)), true);
  });
});
