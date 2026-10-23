import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { requirePanelAdmin, TenantGuard, TenantRequest } from './tenant.guard';

const empresaId = '11111111-1111-4111-8111-111111111111';

function contextFor(request: Partial<TenantRequest>) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as never;
}

describe('TenantGuard', () => {
  it('rejeita rota sem credencial', async () => {
    const request = { header: () => undefined } as Partial<TenantRequest>;
    const guard = new TenantGuard({ query: async () => ({ rows: [] }) } as never, {} as never);

    await assert.rejects(() => guard.canActivate(contextFor(request)), { message: 'Credencial ausente' });
  });

  it('deriva a empresa somente da sessão assinada', async () => {
    const request = { header: () => 'Bearer painel-assinado' } as unknown as Partial<TenantRequest>;
    const auth = { verifySession: () => ({ usuarioId: 'u1', empresaId, nome: 'Ana', email: 'ana@empresa.test', papel: 'admin' as const }) };
    const guard = new TenantGuard({ query: async () => ({ rows: [] }) } as never, auth as never);

    assert.equal(await guard.canActivate(contextFor(request)), true);
    assert.equal(request.empresaId, empresaId);
    assert.equal(request.session?.papel, 'admin');
  });

  it('rejeita formato de token de tenant adulterado', async () => {
    const request = { header: () => 'Bearer daza_apenas-duas-partes' } as unknown as Partial<TenantRequest>;
    const guard = new TenantGuard({ query: async () => ({ rows: [] }) } as never, {} as never);

    await assert.rejects(() => guard.canActivate(contextFor(request)), { message: 'Token de tenant inválido' });
  });

  it('não permite que operador altere configurações administrativas', () => {
    const request = { session: { usuarioId: 'u2', empresaId, nome: 'Operador', email: 'op@empresa.test', papel: 'operador' as const } } as TenantRequest;

    assert.throws(() => requirePanelAdmin(request), { message: 'Ação disponível apenas para administradores da empresa' });
  });
});
