import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtPayload, sign, verify } from 'jsonwebtoken';
import { DatabaseService } from './database.service';

type AuthenticatedUser = {
  id: string;
  empresa_id: string;
  nome: string;
  email: string;
  senha_hash: string;
  papel: 'admin' | 'operador';
};

export type SessionIdentity = {
  usuarioId: string;
  empresaId: string;
  nome: string;
  email: string;
  papel: 'admin' | 'operador';
};

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async hashPassword(password: string) {
    return bcrypt.hash(password, 12);
  }

  async login(email: string, password: string) {
    const result = await this.db.query<AuthenticatedUser>('select * from atendimento.autenticar_usuario($1)', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.senha_hash))) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    await this.db.withTenant(user.empresa_id, async (client) => {
      await client.query('update atendimento.usuarios set ultimo_login_em = now() where id = $1', [user.id]);
    });
    const identity: SessionIdentity = {
      usuarioId: user.id,
      empresaId: user.empresa_id,
      nome: user.nome,
      email: user.email,
      papel: user.papel,
    };
    return { accessToken: this.signSession(identity), usuario: identity };
  }

  verifySession(token: string): SessionIdentity {
    const secret = this.sessionSecret();
    try {
      const payload = verify(token, secret, { issuer: 'daza-atendimento', audience: 'painel' }) as JwtPayload;
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.empresaId !== 'string' ||
        typeof payload.nome !== 'string' ||
        typeof payload.email !== 'string' ||
        (payload.papel !== 'admin' && payload.papel !== 'operador')
      ) throw new Error('payload inválido');
      return { usuarioId: payload.sub, empresaId: payload.empresaId, nome: payload.nome, email: payload.email, papel: payload.papel };
    } catch {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }
  }

  private signSession(identity: SessionIdentity) {
    return sign(
      { empresaId: identity.empresaId, nome: identity.nome, email: identity.email, papel: identity.papel },
      this.sessionSecret(),
      { subject: identity.usuarioId, expiresIn: '8h', issuer: 'daza-atendimento', audience: 'painel' },
    );
  }

  private sessionSecret() {
    const secret = process.env.SESSION_JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('SESSION_JWT_SECRET deve ter ao menos 32 caracteres');
    return secret;
  }
}
