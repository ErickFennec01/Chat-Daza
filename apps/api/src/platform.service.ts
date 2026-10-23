import { Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from './database.service';
import { CreateApiKeyDto, CreateDocumentoDto, CreateEmpresaDto, ResolveQuestionDto, UpsertAgentDto } from './dto';

function tokenHash(token: string): string {
  const pepper = process.env.TENANT_TOKEN_PEPPER;
  if (!pepper) throw new Error('TENANT_TOKEN_PEPPER é obrigatório');
  return createHmac('sha256', pepper).update(token).digest('hex');
}

@Injectable()
export class AppService {
  constructor(private readonly db: DatabaseService) {}

  async health() {
    await this.db.query('select 1');
    return { status: 'ok' as const };
  }

  async createEmpresa(input: CreateEmpresaDto) {
    const result = await this.db.query<{ id: string; razao_social: string; slug: string }>(
      'insert into atendimento.empresas (empresa_erp_id, razao_social, slug) values ($1, $2, $3) returning id, razao_social, slug',
      [input.empresaErpId ?? null, input.razaoSocial.trim(), input.slug],
    );
    return result.rows[0];
  }

  async createApiKey(empresaId: string, input: CreateApiKeyDto) {
    const prefixo = randomBytes(6).toString('hex');
    const segredo = randomBytes(32).toString('base64url');
    const token = `daza_${prefixo}_${segredo}`;
    await this.db.withTenant(empresaId, async (client) => {
      await client.query(
        'insert into atendimento.api_chaves (empresa_id, nome, prefixo, segredo_hash) values ($1, $2, $3, $4)',
        [empresaId, input.nome.trim(), prefixo, tokenHash(token)],
      );
    });
    return { token, prefixo, aviso: 'Exiba este token somente uma vez e guarde-o em local seguro.' };
  }

  async listAgents(empresaId: string) {
    return this.withTenantRows(empresaId, 'select id, nome, ativo, system_prompt, modelo, temperatura, limite_resposta_tokens, limiar_confianca, versao_conhecimento, updated_at from atendimento.agentes order by nome');
  }

  async upsertAgent(empresaId: string, input: UpsertAgentDto) {
    return this.db.withTenant(empresaId, async (client) => {
      const params = [empresaId, input.nome.trim(), input.systemPrompt, input.modelo, input.temperatura, input.limiteRespostaTokens, input.limiarConfianca, input.ativo ?? true];
      const query = input.id
        ? 'update atendimento.agentes set nome=$2, system_prompt=$3, modelo=$4, temperatura=$5, limite_resposta_tokens=$6, limiar_confianca=$7, ativo=$8 where id=$9 and empresa_id=$1 returning *'
        : 'insert into atendimento.agentes (empresa_id,nome,system_prompt,modelo,temperatura,limite_resposta_tokens,limiar_confianca,ativo) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *';
      const result = await client.query(query, input.id ? [...params, input.id] : params);
      if (!result.rows[0]) throw new NotFoundException('Agente não encontrado');
      return result.rows[0];
    });
  }

  async listDocuments(empresaId: string) {
    return this.withTenantRows(empresaId, 'select id, titulo, conteudo, fonte, ativo, updated_at from atendimento.documentos order by updated_at desc');
  }

  async createDocument(empresaId: string, input: CreateDocumentoDto) {
    return this.db.withTenant(empresaId, async (client) => {
      const result = await client.query(
        'insert into atendimento.documentos (empresa_id, titulo, conteudo, fonte) values ($1, $2, $3, $4) returning id, titulo, fonte, created_at',
        [empresaId, input.titulo.trim(), input.conteudo, input.fonte?.trim() ?? null],
      );
      return result.rows[0];
    });
  }

  async listUnknownQuestions(empresaId: string) {
    return this.withTenantRows(empresaId, 'select id, conversa_id, pergunta, motivo, status, resposta_curada, created_at from atendimento.perguntas_sem_resposta order by created_at desc');
  }

  async resolveUnknownQuestion(empresaId: string, id: string, input: ResolveQuestionDto) {
    return this.db.withTenant(empresaId, async (client) => {
      const result = await client.query(
        "update atendimento.perguntas_sem_resposta set status=$2, resposta_curada=$3, resolvida_at=case when $2='respondida' then now() else resolvida_at end where id=$1 returning *",
        [id, input.status, input.respostaCurada ?? null],
      );
      if (!result.rows[0]) throw new NotFoundException('Dúvida não encontrada');
      return result.rows[0];
    });
  }

  async processAgentDecision(decision: { empresaId: string; conversaId: string; acao: string; resposta: string; modelo: string; ragCache?: boolean; motivoEscalonamento?: string }) {
    return this.db.withTenant(decision.empresaId, async (client) => {
      await client.query('select atendimento.registrar_saida($1::uuid, $2::uuid, $3, $4)', [decision.empresaId, decision.conversaId, decision.resposta, decision.modelo]);
      if (decision.acao === 'escalar') {
        await client.query('select atendimento.finalizar_conversa($1::uuid, $2::uuid, $3, $4, $5)', [decision.empresaId, decision.conversaId, 'aguardando_humano', decision.motivoEscalonamento ?? null, 'ia_escalou']);
        await client.query(
          "insert into atendimento.perguntas_sem_resposta (empresa_id, conversa_id, pergunta, motivo) values ($1, $2, $3, 'escalonamento')",
          [decision.empresaId, decision.conversaId, decision.motivoEscalonamento ?? decision.resposta],
        );
      }
      return { aceita: true };
    });
  }

  async resolveWhatsAppChannel(phoneNumberId: string) {
    const result = await this.db.query<{ empresa_id: string; canal_id: string; agente_id: string; provedor: string }>(
      'select * from atendimento.resolver_canal_whatsapp($1)', [phoneNumberId],
    );
    return result.rows[0] ?? null;
  }

  private async withTenantRows(empresaId: string, text: string) {
    return this.db.withTenant(empresaId, async (client: PoolClient) => (await client.query(text)).rows);
  }
}
