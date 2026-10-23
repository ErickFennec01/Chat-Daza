import { Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from './database.service';
import { CreateApiKeyDto, CreateDocumentoDto, CreateEmpresaDto, CreateUserDto, CreateWhatsAppChannelDto, ResolveQuestionDto, UpdateDocumentoDto, UpdateWhatsAppChannelDto, UpsertAgentDto } from './dto';
import { AuthService } from './auth.service';
import { ListConversationsQueryDto } from './dto';
import { ChannelCryptoService } from './channel-crypto.service';

function tokenHash(token: string): string {
  const pepper = process.env.TENANT_TOKEN_PEPPER;
  if (!pepper) throw new Error('TENANT_TOKEN_PEPPER é obrigatório');
  return createHmac('sha256', pepper).update(token).digest('hex');
}

@Injectable()
export class AppService {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService, private readonly channelCrypto: ChannelCryptoService) {}

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

  async createPanelUser(empresaId: string, input: CreateUserDto) {
    const senhaHash = await this.auth.hashPassword(input.senha);
    return this.db.withTenant(empresaId, async (client) => {
      const result = await client.query(
        'insert into atendimento.usuarios (empresa_id, nome, email, senha_hash, papel) values ($1, $2, lower($3), $4, $5) returning id, empresa_id, nome, email, papel, ativo, created_at',
        [empresaId, input.nome.trim(), input.email.trim(), senhaHash, input.papel],
      );
      return result.rows[0];
    });
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

  async deactivateAgent(empresaId: string, id: string) {
    return this.db.withTenant(empresaId, async (client) => {
      const result = await client.query(
        'update atendimento.agentes set ativo=false where id=$1 and empresa_id=$2 returning id, nome, ativo, updated_at',
        [id, empresaId],
      );
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
        'insert into atendimento.documentos (empresa_id, titulo, conteudo, fonte, ativo) values ($1, $2, $3, $4, $5) returning id, titulo, fonte, ativo, created_at',
        [empresaId, input.titulo.trim(), input.conteudo, input.fonte?.trim() ?? null, input.ativo ?? true],
      );
      return result.rows[0];
    });
  }

  async updateDocument(empresaId: string, id: string, input: UpdateDocumentoDto) {
    return this.db.withTenant(empresaId, async (client) => {
      const result = await client.query(
        'update atendimento.documentos set titulo=coalesce($3, titulo), conteudo=coalesce($4, conteudo), fonte=coalesce($5, fonte), ativo=coalesce($6, ativo) where id=$1 and empresa_id=$2 returning id, titulo, conteudo, fonte, ativo, updated_at',
        [id, empresaId, input.titulo?.trim() ?? null, input.conteudo ?? null, input.fonte?.trim() ?? null, input.ativo ?? null],
      );
      if (!result.rows[0]) throw new NotFoundException('Documento não encontrado');
      return result.rows[0];
    });
  }

  async deleteDocument(empresaId: string, id: string) {
    return this.db.withTenant(empresaId, async (client) => {
      const result = await client.query('delete from atendimento.documentos where id=$1 and empresa_id=$2 returning id', [id, empresaId]);
      if (!result.rows[0]) throw new NotFoundException('Documento não encontrado');
      return { removido: true };
    });
  }

  async listWhatsAppChannels(empresaId: string) {
    return this.withTenantRows(empresaId, 'select id, agente_id, phone_number_id, display_name, provedor, ativo, token_cifrado is not null as token_configurado, created_at, updated_at from atendimento.canais_whatsapp order by created_at desc');
  }

  async createWhatsAppChannel(empresaId: string, input: CreateWhatsAppChannelDto) {
    const tokenCifrado = this.channelCrypto.encrypt(input.accessToken.trim());
    return this.db.withTenant(empresaId, async (client) => {
      await this.ensureAgentBelongsToTenant(client, empresaId, input.agenteId);
      const integration = await client.query<{ id: string }>(
        "insert into atendimento.integracoes_canais (empresa_id, canal, identificador_destino) values ($1, 'whatsapp', $2) returning id",
        [empresaId, input.phoneNumberId.trim()],
      );
      const result = await client.query(
        `insert into atendimento.canais_whatsapp (empresa_id, integracao_id, agente_id, phone_number_id, display_name, token_cifrado)
         values ($1, $2, $3, $4, $5, $6)
         returning id, agente_id, phone_number_id, display_name, provedor, ativo, created_at`,
        [empresaId, integration.rows[0].id, input.agenteId, input.phoneNumberId.trim(), input.displayName?.trim() ?? null, tokenCifrado],
      );
      return result.rows[0];
    });
  }

  async updateWhatsAppChannel(empresaId: string, id: string, input: UpdateWhatsAppChannelDto) {
    const tokenCifrado = input.accessToken ? this.channelCrypto.encrypt(input.accessToken.trim()) : null;
    return this.db.withTenant(empresaId, async (client) => {
      if (input.agenteId) await this.ensureAgentBelongsToTenant(client, empresaId, input.agenteId);
      const result = await client.query(
        `update atendimento.canais_whatsapp
            set agente_id=coalesce($3, agente_id), display_name=coalesce($4, display_name),
                token_cifrado=coalesce($5, token_cifrado), ativo=coalesce($6, ativo)
          where id=$1 and empresa_id=$2
          returning id, agente_id, phone_number_id, display_name, provedor, ativo, token_cifrado is not null as token_configurado, updated_at`,
        [id, empresaId, input.agenteId ?? null, input.displayName?.trim() ?? null, tokenCifrado, input.ativo ?? null],
      );
      if (!result.rows[0]) throw new NotFoundException('Canal WhatsApp não encontrado');
      await client.query('update atendimento.integracoes_canais set ativo=$3 where id=(select integracao_id from atendimento.canais_whatsapp where id=$1 and empresa_id=$2)', [id, empresaId, result.rows[0].ativo]);
      return result.rows[0];
    });
  }

  async deactivateWhatsAppChannel(empresaId: string, id: string) {
    return this.db.withTenant(empresaId, async (client) => {
      const result = await client.query('update atendimento.canais_whatsapp set ativo=false where id=$1 and empresa_id=$2 returning id, integracao_id, ativo', [id, empresaId]);
      if (!result.rows[0]) throw new NotFoundException('Canal WhatsApp não encontrado');
      await client.query('update atendimento.integracoes_canais set ativo=false where id=$1', [result.rows[0].integracao_id]);
      return { id: result.rows[0].id, ativo: false };
    });
  }

  async listUnknownQuestions(empresaId: string) {
    return this.withTenantRows(empresaId, 'select id, conversa_id, pergunta, motivo, status, resposta_curada, created_at from atendimento.perguntas_sem_resposta order by created_at desc');
  }

  async listConversations(empresaId: string, query: ListConversationsQueryDto) {
    return this.db.withTenant(empresaId, async (client) => {
      const result = await client.query(
        `select c.id, c.canal, c.contato_externo, c.status, c.created_at, c.updated_at, c.assumida_em,
                c.atendida_por_usuario_id,
                ultima.conteudo as ultima_mensagem, ultima.direcao as ultima_mensagem_direcao, ultima.created_at as ultima_mensagem_em
           from atendimento.conversas c
           left join lateral (
             select conteudo, direcao, created_at from atendimento.mensagens
             where conversa_id = c.id order by created_at desc limit 1
           ) ultima on true
          where c.empresa_id = $1 and ($2::text is null or c.status = $2)
          order by c.updated_at desc limit $3`,
        [empresaId, query.status ?? null, query.limit ?? 30],
      );
      return result.rows;
    });
  }

  async getConversation(empresaId: string, conversationId: string) {
    return this.db.withTenant(empresaId, async (client) => {
      const conversation = await client.query(
        `select c.id, c.canal, c.contato_externo, c.status, c.created_at, c.updated_at, c.assumida_em,
                c.resumo_final, c.codigo_resolucao, c.atendida_por_usuario_id
           from atendimento.conversas c
          where c.id = $1 and c.empresa_id = $2`,
        [conversationId, empresaId],
      );
      if (!conversation.rows[0]) throw new NotFoundException('Conversa não encontrada');
      const messages = await client.query(
        'select id, direcao, conteudo, modelo, status, created_at from atendimento.mensagens where conversa_id=$1 and empresa_id=$2 order by created_at asc',
        [conversationId, empresaId],
      );
      return { ...conversation.rows[0], mensagens: messages.rows };
    });
  }

  async assumeConversation(empresaId: string, conversationId: string, usuarioId: string) {
    return this.db.withTenant(empresaId, async (client) => {
      const result = await client.query(
        `update atendimento.conversas
            set atendida_por_usuario_id=$3, assumida_em=coalesce(assumida_em, now()), status='aguardando_humano', updated_at=now()
          where id=$1 and empresa_id=$2 and status in ('aberta', 'aguardando_humano')
          returning id, status, atendida_por_usuario_id, assumida_em`,
        [conversationId, empresaId, usuarioId],
      );
      if (!result.rows[0]) throw new NotFoundException('Conversa não encontrada ou já finalizada');
      return result.rows[0];
    });
  }

  async metrics(empresaId: string) {
    return this.db.withTenant(empresaId, async (client) => {
      const result = await client.query(
        `select
           (select count(*)::int from atendimento.conversas where empresa_id=$1 and status in ('aberta', 'aguardando_humano')) as conversas_ativas,
           (select count(*)::int from atendimento.conversas where empresa_id=$1 and status='aguardando_humano') as aguardando_humano,
           (select count(*)::int from atendimento.conversas where empresa_id=$1 and created_at >= now() - interval '7 days') as conversas_7_dias,
           (select count(*)::int from atendimento.execucoes_agente where empresa_id=$1 and iniciada_at >= now() - interval '7 days') as execucoes_ia_7_dias,
           (select coalesce(sum(tokens_entrada + tokens_saida), 0)::int from atendimento.execucoes_agente where empresa_id=$1 and iniciada_at >= now() - interval '7 days') as tokens_ia_7_dias,
           (select count(*)::int from atendimento.perguntas_sem_resposta where empresa_id=$1 and status in ('aberta', 'em_revisao')) as duvidas_abertas`,
        [empresaId],
      );
      return result.rows[0];
    });
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
    const delivery = await this.db.withTenant(decision.empresaId, async (client) => {
      const message = await client.query<{ mensagem_id: string }>('select atendimento.registrar_saida($1::uuid, $2::uuid, $3, $4) as mensagem_id', [decision.empresaId, decision.conversaId, decision.resposta, decision.modelo]);
      const conversation = await client.query<{ canal: string; contato_externo: string; canal_id: string | null }>(
        "select canal, contato_externo, metadados->>'canal_id' as canal_id from atendimento.conversas where id=$1 and empresa_id=$2",
        [decision.conversaId, decision.empresaId],
      );
      if (!conversation.rows[0]) throw new NotFoundException('Conversa não encontrada');
      const channelId = await this.resolveOutgoingChannelId(client, decision.empresaId, conversation.rows[0].canal, conversation.rows[0].canal_id);
      const queued = await client.query<{ id: string }>(
        `insert into atendimento.entregas_mensagens (empresa_id, conversa_id, mensagem_id, canal_whatsapp_id, status, erro_codigo)
         values ($1, $2, $3, $4, case when $4 is null then 'falha' else 'pendente' end, case when $4 is null then 'CANAL_NAO_CONFIGURADO' else null end)
         returning id`,
        [decision.empresaId, decision.conversaId, message.rows[0].mensagem_id, channelId],
      );
      if (decision.acao === 'escalar') {
        await client.query('select atendimento.finalizar_conversa($1::uuid, $2::uuid, $3, $4, $5)', [decision.empresaId, decision.conversaId, 'aguardando_humano', decision.motivoEscalonamento ?? null, 'ia_escalou']);
        await client.query(
          "insert into atendimento.perguntas_sem_resposta (empresa_id, conversa_id, pergunta, motivo) values ($1, $2, $3, 'escalonamento')",
          [decision.empresaId, decision.conversaId, decision.motivoEscalonamento ?? decision.resposta],
        );
      }
      return { id: queued.rows[0].id, canalConfigurado: channelId !== null };
    });
    if (!delivery.canalConfigurado) return { aceita: true, entregaId: delivery.id, statusEntrega: 'falha', motivo: 'Canal WhatsApp não configurado para a conversa' };
    const statusEntrega = await this.deliverWhatsAppMessage(decision.empresaId, delivery.id);
    return { aceita: true, entregaId: delivery.id, statusEntrega };
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

  private async ensureAgentBelongsToTenant(client: PoolClient, empresaId: string, agentId: string) {
    const agent = await client.query('select id from atendimento.agentes where id=$1 and empresa_id=$2 and ativo', [agentId, empresaId]);
    if (!agent.rows[0]) throw new NotFoundException('Agente ativo não encontrado para a empresa');
  }

  private async resolveOutgoingChannelId(client: PoolClient, empresaId: string, canal: string, configuredChannelId: string | null) {
    if (canal !== 'whatsapp') return null;
    if (configuredChannelId && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(configuredChannelId)) {
      const selected = await client.query<{ id: string }>('select id from atendimento.canais_whatsapp where id=$1 and empresa_id=$2 and ativo', [configuredChannelId, empresaId]);
      if (selected.rows[0]) return selected.rows[0].id;
    }
    const candidates = await client.query<{ id: string }>('select id from atendimento.canais_whatsapp where empresa_id=$1 and ativo order by created_at asc limit 2', [empresaId]);
    return candidates.rows.length === 1 ? candidates.rows[0].id : null;
  }

  private async deliverWhatsAppMessage(empresaId: string, deliveryId: string): Promise<'enviada' | 'falha'> {
    const delivery = await this.db.withTenant(empresaId, async (client) => {
      const claimed = await client.query<{ id: string; canal_whatsapp_id: string | null; conteudo: string; contato_externo: string }>(
        `update atendimento.entregas_mensagens set status='processando', tentativas=tentativas+1, erro_codigo=null, erro_detalhe=null
          where id=$1 and empresa_id=$2 and status='pendente'
          returning id, canal_whatsapp_id,
            (select conteudo from atendimento.mensagens where id=mensagem_id) as conteudo,
            (select contato_externo from atendimento.conversas where id=conversa_id) as contato_externo`,
        [deliveryId, empresaId],
      );
      if (!claimed.rows[0]) return null;
      if (!claimed.rows[0].canal_whatsapp_id) return claimed.rows[0];
      const channel = await client.query<{ phone_number_id: string; token_cifrado: Buffer | null }>(
        'select phone_number_id, token_cifrado from atendimento.canais_whatsapp where id=$1 and empresa_id=$2 and ativo',
        [claimed.rows[0].canal_whatsapp_id, empresaId],
      );
      return { ...claimed.rows[0], channel: channel.rows[0] ?? null };
    });
    if (!delivery || !('channel' in delivery) || !delivery.channel?.token_cifrado) {
      await this.failDelivery(empresaId, deliveryId, 'CANAL_NAO_CONFIGURADO', 'Canal ativo ou token cifrado indisponível');
      return 'falha';
    }
    try {
      const token = this.channelCrypto.decrypt(delivery.channel.token_cifrado);
      const graphVersion = process.env.META_GRAPH_API_VERSION ?? 'v22.0';
      const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(delivery.channel.phone_number_id)}/messages`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: delivery.contato_externo, type: 'text', text: { body: delivery.conteudo } }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json().catch(() => ({})) as { messages?: Array<{ id?: string }>; error?: { code?: number; message?: string } };
      if (!response.ok || !payload.messages?.[0]?.id) {
        await this.failDelivery(empresaId, deliveryId, `META_${payload.error?.code ?? response.status}`, payload.error?.message ?? 'Meta não confirmou a entrega');
        return 'falha';
      }
      await this.db.withTenant(empresaId, async (client) => {
        await client.query("update atendimento.entregas_mensagens set status='enviada', provedor_mensagem_id=$3, enviada_em=now() where id=$1 and empresa_id=$2", [deliveryId, empresaId, payload.messages![0].id]);
      });
      return 'enviada';
    } catch {
      await this.failDelivery(empresaId, deliveryId, 'META_INDISPONIVEL', 'Falha de rede ou cifra ao comunicar com a Meta');
      return 'falha';
    }
  }

  private async failDelivery(empresaId: string, deliveryId: string, code: string, detail: string) {
    await this.db.withTenant(empresaId, async (client) => {
      await client.query("update atendimento.entregas_mensagens set status='falha', erro_codigo=$3, erro_detalhe=left($4, 2000), proxima_tentativa_em=now() + interval '5 minutes' where id=$1 and empresa_id=$2", [deliveryId, empresaId, code, detail]);
    });
  }
}
