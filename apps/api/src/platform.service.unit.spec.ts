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
});
