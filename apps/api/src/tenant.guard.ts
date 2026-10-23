import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { DatabaseService } from './database.service';
import { AuthService, SessionIdentity } from './auth.service';

export type TenantRequest = Request & { empresaId?: string; session?: SessionIdentity };

function hashToken(token: string): string {
  const pepper = process.env.TENANT_TOKEN_PEPPER;
  if (!pepper) throw new Error('TENANT_TOKEN_PEPPER é obrigatório');
  return createHmac('sha256', pepper).update(token).digest('hex');
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const value = request.header('authorization');
    const token = value?.startsWith('Bearer ') ? value.slice(7) : '';
    if (!token) throw new UnauthorizedException('Credencial ausente');
    if (token.startsWith('daza_')) {
      const pieces = token.split('_');
      if (pieces.length !== 3 || pieces[0] !== 'daza') throw new UnauthorizedException('Token de tenant inválido');
      const prefixo = pieces[1];
      const result = await this.db.query<{ empresa_id: string }>(
        'select atendimento.autenticar_api_chave($1, $2) as empresa_id', [prefixo, hashToken(token)],
      );
      const empresaId = result.rows[0]?.empresa_id;
      if (!empresaId) throw new UnauthorizedException('Token de tenant inválido ou expirado');
      request.empresaId = empresaId;
      return true;
    }
    const session = this.auth.verifySession(token);
    request.empresaId = session.empresaId;
    request.session = session;
    return true;
  }
}

export function requireInternalKey(received: string | undefined): void {
  const expected = process.env.DAZA_INTERNAL_API_KEY;
  if (!expected || !received || expected.length !== received.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
    throw new UnauthorizedException('Chave interna inválida');
  }
}

export function requireAdminKey(received: string | undefined): void {
  const expected = process.env.DAZA_ADMIN_KEY;
  if (!expected || !received || expected.length !== received.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
    throw new UnauthorizedException('Chave administrativa inválida');
  }
}

export function requirePanelAdmin(request: TenantRequest): void {
  if (!request.session || request.session.papel !== 'admin') {
    throw new ForbiddenException('Ação disponível apenas para administradores da empresa');
  }
}
