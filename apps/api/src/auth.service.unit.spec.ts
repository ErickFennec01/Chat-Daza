import { beforeEach, describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

const empresaId = '11111111-1111-4111-8111-111111111111';
const usuarioId = '22222222-2222-4222-8222-222222222222';

describe('AuthService', () => {
  beforeEach(() => {
    process.env.SESSION_JWT_SECRET = 'teste-sessao-segura-com-mais-de-trinta-e-dois-caracteres';
  });

  it('emite uma sessão com empresa e papel após credenciais válidas', async () => {
    const senhaHash = await bcrypt.hash('senha-de-teste-segura', 4);
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const db = {
      query: async (text: string, values: unknown[] = []) => {
        calls.push({ text, values });
        if (text.includes('autenticar_usuario')) return { rows: [{ id: usuarioId, empresa_id: empresaId, nome: 'Ana', email: 'ana@empresa.test', papel: 'admin', senha_hash: senhaHash }] };
        return { rows: [] };
      },
    };
    const service = new AuthService(db as never);

    const result = await service.login('ana@empresa.test', 'senha-de-teste-segura');

    assert.equal(result.usuario.empresaId, empresaId);
    assert.equal(result.usuario.papel, 'admin');
    assert.equal(service.verifySession(result.accessToken).usuarioId, usuarioId);
    assert.equal(calls.some((call) => call.text.includes('registrar_login_usuario')), true);
  });

  it('não emite token para senha inválida', async () => {
    const db = { query: async () => ({ rows: [] }) };
    const service = new AuthService(db as never);

    await assert.rejects(() => service.login('ausente@empresa.test', 'senha-invalida'), { message: 'E-mail ou senha inválidos' });
  });

  it('rejeita token assinado para o público errado', () => {
    const db = { query: async () => ({ rows: [] }) };
    const service = new AuthService(db as never);

    assert.throws(() => service.verifySession('token-invalido'), { message: 'Sessão inválida ou expirada' });
  });
});
