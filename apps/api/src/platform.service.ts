import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from './database.service';
import { CreateApiKeyDto, CreateDocumentoDto, CreateEmpresaDto, CreateQueueDto, CreateUserDto, CreateWhatsAppChannelDto, ResolveQuestionDto, UpdateDocumentoDto, UpdateOperationPolicyDto, UpdateQueueDto, UpdateWhatsAppChannelDto, UpsertAgentDto, UpsertScriptDto } from './dto';
import { AuthService } from './auth.service';
import { ListConversationsQueryDto } from './dto';
import { WahaService } from './waha.service';

function tokenHash(token: string): string {
  const pepper = process.env.TENANT_TOKEN_PEPPER;
  if (!pepper) throw new Error('TENANT_TOKEN_PEPPER é obrigatório');
  return createHmac('sha256', pepper).update(token).digest('hex');
}

@Injectable()
export class AppService {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService, private readonly waha: WahaService) {}

  async health() {
    await this.db.query('select 1');
    return { status: 'ok' as const };
  }

  async createEmpresa(input: CreateEmpresaDto) {
    const result = await this.db.query<{ id: string; razao_social: string; slug: string }>(
      'select * from atendimento.criar_empresa($1::uuid, $2, $3)',
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
        'select * from atendimento.criar_usuario_painel($1::uuid, $2, $3, $4, $5)',
        [empresaId, input.nome.trim(), input.email.trim(), senhaHash, input.papel],
      );
      return result.rows[0];
    });
  }

  async listAgents(empresaId: string) {
    return this.withTenantRows(empresaId, 'select id, nome, ativo, system_prompt, modelo, temperatura, limite_resposta_tokens, limiar_confianca, versao_conhecimento, roteiro_id, updated_at from atendimento.agentes order by nome');
  }

  async upsertAgent(empresaId: string, input: UpsertAgentDto) {
    return this.db.withTenant(empresaId, async (client) => {
      if (input.roteiroId) {
        const roteiro = await client.query('select id from atendimento.roteiros_atendimento where id=$1 and empresa_id=$2 and ativo', [input.roteiroId, empresaId]);
        if (!roteiro.rows[0]) throw new NotFoundException('Roteiro ativo não encontrado para a empresa');
      }
      const params = [empresaId, input.nome.trim(), input.systemPrompt, input.modelo, input.temperatura, input.limiteRespostaTokens, input.limiarConfianca, input.ativo ?? true, input.roteiroId ?? null];
      const query = input.id
        ? 'update atendimento.agentes set nome=$2, system_prompt=$3, modelo=$4, temperatura=$5, limite_resposta_tokens=$6, limiar_confianca=$7, ativo=$8, roteiro_id=$9 where id=$10 and empresa_id=$1 returning *'
        : 'insert into atendimento.agentes (empresa_id,nome,system_prompt,modelo,temperatura,limite_resposta_tokens,limiar_confianca,ativo,roteiro_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *';
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

  async assignAgentScript(empresaId: string, agentId: string, roteiroId: string | null) {
    return this.db.withTenant(empresaId, async (client) => {
      if (roteiroId) {
        const roteiro = await client.query('select id from atendimento.roteiros_atendimento where id=$1 and empresa_id=$2 and ativo', [roteiroId, empresaId]);
        if (!roteiro.rows[0]) throw new NotFoundException('Roteiro ativo não encontrado para a empresa');
      }
      const result = await client.query(
        'update atendimento.agentes set roteiro_id=$3 where id=$1 and empresa_id=$2 returning id, nome, roteiro_id, updated_at',
        [agentId, empresaId, roteiroId],
      );
      if (!result.rows[0]) throw new NotFoundException('Agente não encontrado para a empresa');
      return result.rows[0];
    });
  }

  async listDocuments(empresaId: string) {
    return this.withTenantRows(empresaId, 'select id, titulo, conteudo, fonte, ativo, updated_at from atendimento.documentos order by updated_at desc');
  }

  async listScripts(empresaId: string) {
    return this.withTenantRows(empresaId, 'select id, nome, descricao, etapas, ativo, updated_at from atendimento.roteiros_atendimento order by updated_at desc');
  }

  async upsertScript(empresaId: string, input: UpsertScriptDto, id?: string) {
    const etapas = this.normalizeScriptSteps(input.etapas);
    return this.db.withTenant(empresaId, async (client) => {
      const result = id
        ? await client.query('update atendimento.roteiros_atendimento set nome=$3, descricao=$4, etapas=$5::jsonb, ativo=$6 where id=$1 and empresa_id=$2 returning id,nome,descricao,etapas,ativo,updated_at', [id, empresaId, input.nome.trim(), input.descricao?.trim() ?? '', JSON.stringify(etapas), input.ativo ?? true])
        : await client.query('insert into atendimento.roteiros_atendimento (empresa_id,nome,descricao,etapas,ativo) values ($1,$2,$3,$4::jsonb,$5) returning id,nome,descricao,etapas,ativo,updated_at', [empresaId, input.nome.trim(), input.descricao?.trim() ?? '', JSON.stringify(etapas), input.ativo ?? true]);
      if (!result.rows[0]) throw new NotFoundException('Roteiro não encontrado');
      return result.rows[0];
    });
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
    return this.withTenantRows(empresaId, "select id, agente_id, sessao_waha, display_name, provedor, ativo, created_at, updated_at from atendimento.canais_whatsapp where provedor='waha' order by created_at desc");
  }

  async createWhatsAppChannel(empresaId: string, input: CreateWhatsAppChannelDto) {
    const session = input.sessao.trim();
    return this.db.withTenant(empresaId, async (client) => {
      await this.ensureAgentBelongsToTenant(client, empresaId, input.agenteId);
      const integration = await client.query<{ id: string }>(
        "insert into atendimento.integracoes_canais (empresa_id, canal, identificador_destino) values ($1, 'whatsapp', $2) returning id",
        [empresaId, session],
      );
      const result = await client.query(
        `insert into atendimento.canais_whatsapp (empresa_id, integracao_id, agente_id, provedor, phone_number_id, sessao_waha, display_name)
         values ($1, $2, $3, 'waha', $4, $4, $5)
         returning id, agente_id, sessao_waha, display_name, provedor, ativo, created_at`,
        [empresaId, integration.rows[0].id, input.agenteId, session, input.displayName?.trim() ?? null],
      );
      return result.rows[0];
    });
  }

  async updateWhatsAppChannel(empresaId: string, id: string, input: UpdateWhatsAppChannelDto) {
    return this.db.withTenant(empresaId, async (client) => {
      if (input.agenteId) await this.ensureAgentBelongsToTenant(client, empresaId, input.agenteId);
      const result = await client.query(
        `update atendimento.canais_whatsapp
            set agente_id=coalesce($3, agente_id), display_name=coalesce($4, display_name), ativo=coalesce($5, ativo)
          where id=$1 and empresa_id=$2
          returning id, agente_id, sessao_waha, display_name, provedor, ativo, updated_at`,
        [id, empresaId, input.agenteId ?? null, input.displayName?.trim() ?? null, input.ativo ?? null],
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

  async connectWhatsAppChannel(empresaId: string, id: string) {
    const channel = await this.db.withTenant(empresaId, async (client) => {
      const result = await client.query<{ sessao_waha: string }>("select sessao_waha from atendimento.canais_whatsapp where id=$1 and empresa_id=$2 and provedor='waha' and ativo", [id, empresaId]);
      if (!result.rows[0]?.sessao_waha) throw new NotFoundException('Canal WAHA ativo não encontrado');
      return result.rows[0];
    });
    await this.waha.startSession(channel.sessao_waha);
    return { sessao: channel.sessao_waha, qrDataUrl: await this.waha.getQrDataUrl(channel.sessao_waha) };
  }

  async getWhatsAppChannelStatus(empresaId: string, id: string) {
    const channel = await this.db.withTenant(empresaId, async (client) => {
      const result = await client.query<{ sessao_waha: string }>("select sessao_waha from atendimento.canais_whatsapp where id=$1 and empresa_id=$2 and provedor='waha' and ativo", [id, empresaId]);
      if (!result.rows[0]?.sessao_waha) throw new NotFoundException('Canal WAHA ativo não encontrado');
      return result.rows[0];
    });
    return { sessao: channel.sessao_waha, ...(await this.waha.getSessionStatus(channel.sessao_waha)) };
  }

  async listUnknownQuestions(empresaId: string) {
    return this.withTenantRows(empresaId, `select p.id, p.conversa_id, p.pergunta, p.motivo, p.status, p.resposta_curada, p.created_at,
      c.contato_externo, c.canal
      from atendimento.perguntas_sem_resposta p
      left join atendimento.conversas c on c.id=p.conversa_id and c.empresa_id=p.empresa_id
      order by p.created_at desc`);
  }

  async getOperationPolicy(empresaId: string) {
    return this.db.withTenant(empresaId, async (client) => {
      const result = await client.query(
        `insert into atendimento.politicas_atendimento (empresa_id)
         values ($1) on conflict (empresa_id) do update set atualizado_em=atendimento.politicas_atendimento.atualizado_em
         returning janela_reabertura_minutos, sla_primeira_resposta_minutos, atualizado_em`,
        [empresaId],
      );
      return result.rows[0];
    });
  }

  async updateOperationPolicy(empresaId: string, input: UpdateOperationPolicyDto) {
    return this.db.withTenant(empresaId, async (client) => {
      const result = await client.query(
        `insert into atendimento.politicas_atendimento (empresa_id, janela_reabertura_minutos, sla_primeira_resposta_minutos)
         values ($1, coalesce($2, 0), coalesce($3, 15))
         on conflict (empresa_id) do update set
           janela_reabertura_minutos=coalesce($2, atendimento.politicas_atendimento.janela_reabertura_minutos),
           sla_primeira_resposta_minutos=coalesce($3, atendimento.politicas_atendimento.sla_primeira_resposta_minutos), atualizado_em=now()
         returning janela_reabertura_minutos, sla_primeira_resposta_minutos, atualizado_em`,
        [empresaId, input.janelaReaberturaMinutos ?? null, input.slaPrimeiraRespostaMinutos ?? null],
      );
      return result.rows[0];
    });
  }

  async listQueues(empresaId: string) {
    return this.withTenantRows(empresaId, 'select id, nome, descricao, prioridade_padrao, sla_primeira_resposta_minutos, ativo, updated_at from atendimento.filas_atendimento order by ativo desc, nome');
  }

  async listTransferQueues(empresaId: string) {
    return this.withTenantRows(empresaId, 'select id, nome, descricao, prioridade_padrao from atendimento.filas_atendimento where ativo order by prioridade_padrao, nome');
  }

  async createQueue(empresaId: string, input: CreateQueueDto) {
    return this.db.withTenant(empresaId, async (client) => {
      const result = await client.query(
        `insert into atendimento.filas_atendimento (empresa_id, nome, descricao, prioridade_padrao, sla_primeira_resposta_minutos)
         values ($1,$2,$3,$4,$5) returning id, nome, descricao, prioridade_padrao, sla_primeira_resposta_minutos, ativo, updated_at`,
        [empresaId, input.nome.trim(), input.descricao?.trim() ?? '', input.prioridadePadrao ?? 3, input.slaPrimeiraRespostaMinutos ?? null],
      );
      return result.rows[0];
    });
  }

  async updateQueue(empresaId: string, id: string, input: UpdateQueueDto) {
    return this.db.withTenant(empresaId, async (client) => {
      const result = await client.query(
        `update atendimento.filas_atendimento set nome=coalesce($3,nome), descricao=coalesce($4,descricao), prioridade_padrao=coalesce($5,prioridade_padrao), sla_primeira_resposta_minutos=coalesce($6,sla_primeira_resposta_minutos), ativo=coalesce($7,ativo)
          where id=$1 and empresa_id=$2 returning id, nome, descricao, prioridade_padrao, sla_primeira_resposta_minutos, ativo, updated_at`,
        [id, empresaId, input.nome?.trim() ?? null, input.descricao?.trim() ?? null, input.prioridadePadrao ?? null, input.slaPrimeiraRespostaMinutos ?? null, input.ativo ?? null],
      );
      if (!result.rows[0]) throw new NotFoundException('Fila de atendimento não encontrada');
      return result.rows[0];
    });
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

  async transferConversation(empresaId: string, conversationId: string, queueId: string, usuarioId: string, isAdmin: boolean, reason?: string) {
    return this.db.withTenant(empresaId, async (client) => {
      const queue = await client.query('select id, nome from atendimento.filas_atendimento where id=$1 and empresa_id=$2 and ativo', [queueId, empresaId]);
      if (!queue.rows[0]) throw new NotFoundException('Fila ativa não encontrada para a empresa');
      const result = await client.query(
        `update atendimento.conversas
            set fila_atendimento_id=$3, atendida_por_usuario_id=null, assumida_em=null,
                status='aguardando_humano', transferida_em=now(), motivo_transferencia=$6, updated_at=now()
          where id=$1 and empresa_id=$2 and status in ('aberta', 'aguardando_humano')
            and ($4::boolean or atendida_por_usuario_id is null or atendida_por_usuario_id=$5)
          returning id, status, fila_atendimento_id, transferida_em, motivo_transferencia`,
        [conversationId, empresaId, queueId, isAdmin, usuarioId, reason?.trim() || null],
      );
      if (!result.rows[0]) throw new NotFoundException('Conversa não encontrada, finalizada ou atribuída a outro atendente');
      await client.query(
        "select atendimento.registrar_auditoria_atendimento($1::uuid, $2::uuid, $3::uuid, 'usuario', 'conversa_transferida', jsonb_build_object('fila_id', $4::uuid, 'motivo', $5::text))",
        [empresaId, conversationId, usuarioId, queueId, reason?.trim() || null],
      );
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
      const channel = await this.resolveOutgoingChannel(client, decision.empresaId, conversation.rows[0].canal, conversation.rows[0].canal_id);
      const queued = await client.query<{ id: string }>(
        `insert into atendimento.entregas_mensagens (empresa_id, conversa_id, mensagem_id, canal_whatsapp_id, provedor, status, erro_codigo)
         values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text, case when $4::uuid is null then 'falha' else 'pendente' end, case when $4::uuid is null then 'CANAL_NAO_CONFIGURADO' else null end)
         returning id`,
        [decision.empresaId, decision.conversaId, message.rows[0].mensagem_id, channel?.id ?? null, channel?.provedor ?? 'waha'],
      );
      if (decision.acao === 'escalar') {
        await client.query('select atendimento.finalizar_conversa($1::uuid, $2::uuid, $3, $4, $5)', [decision.empresaId, decision.conversaId, 'aguardando_humano', decision.motivoEscalonamento ?? null, 'ia_escalou']);
        const ultimaEntrada = await client.query<{ conteudo: string }>(
          "select conteudo from atendimento.mensagens where empresa_id=$1 and conversa_id=$2 and direcao='entrada' order by created_at desc limit 1",
          [decision.empresaId, decision.conversaId],
        );
        const pergunta = ultimaEntrada.rows[0]?.conteudo?.trim() || decision.motivoEscalonamento || decision.resposta;
        await client.query(
          `insert into atendimento.perguntas_sem_resposta (empresa_id, conversa_id, pergunta, motivo)
           select $1, $2, $3, 'escalonamento'
           where not exists (select 1 from atendimento.perguntas_sem_resposta where empresa_id=$1 and conversa_id=$2 and pergunta=$3 and status in ('aberta','em_revisao'))`,
          [decision.empresaId, decision.conversaId, pergunta],
        );
      }
      return { id: queued.rows[0].id, canalConfigurado: channel !== null };
    });
    if (!delivery.canalConfigurado) return { aceita: true, entregaId: delivery.id, statusEntrega: 'falha', motivo: 'Canal WhatsApp não configurado para a conversa' };
    const statusEntrega = await this.deliverWhatsAppMessage(decision.empresaId, delivery.id);
    return { aceita: true, entregaId: delivery.id, statusEntrega };
  }

  async sendHumanMessage(empresaId: string, conversaId: string, usuarioId: string, conteudo: string) {
    const mensagem = conteudo.trim();
    if (!mensagem) throw new BadRequestException('A mensagem não pode ficar vazia');
    const delivery = await this.db.withTenant(empresaId, async (client) => {
      const conversation = await client.query<{ canal: string; contato_externo: string; canal_id: string | null }>(
        "select canal, contato_externo, metadados->>'canal_id' as canal_id from atendimento.conversas where id=$1 and empresa_id=$2 and status='aguardando_humano' and atendida_por_usuario_id=$3",
        [conversaId, empresaId, usuarioId],
      );
      if (!conversation.rows[0]) throw new NotFoundException('Conversa não está assumida por você');
      const message = await client.query<{ mensagem_id: string }>('select atendimento.registrar_saida($1::uuid, $2::uuid, $3, $4) as mensagem_id', [empresaId, conversaId, mensagem, `humano:${usuarioId}`]);
      const channel = await this.resolveOutgoingChannel(client, empresaId, conversation.rows[0].canal, conversation.rows[0].canal_id);
      const queued = await client.query<{ id: string }>(
        `insert into atendimento.entregas_mensagens (empresa_id, conversa_id, mensagem_id, canal_whatsapp_id, provedor, status, erro_codigo)
         values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text, case when $4::uuid is null then 'falha' else 'pendente' end, case when $4::uuid is null then 'CANAL_NAO_CONFIGURADO' else null end)
         returning id`,
        [empresaId, conversaId, message.rows[0].mensagem_id, channel?.id ?? null, channel?.provedor ?? 'waha'],
      );
      return { id: queued.rows[0].id, canalConfigurado: channel !== null };
    });
    if (!delivery.canalConfigurado) return { aceita: true, entregaId: delivery.id, statusEntrega: 'falha' as const };
    return { aceita: true, entregaId: delivery.id, statusEntrega: await this.deliverWhatsAppMessage(empresaId, delivery.id) };
  }

  async closeConversation(empresaId: string, conversaId: string, usuarioId: string, isAdmin: boolean, resumoFinal?: string) {
    return this.db.withTenant(empresaId, async (client) => {
      const eligible = await client.query<{ id: string }>(
        `select id
           from atendimento.conversas
          where id=$1 and empresa_id=$2 and status in ('aberta', 'aguardando_humano')
            and ($3::boolean or atendida_por_usuario_id=$4::uuid)`,
        [conversaId, empresaId, isAdmin, usuarioId],
      );
      if (!eligible.rows[0]) throw new NotFoundException('Conversa não encontrada, já encerrada ou não atribuída a você');
      await client.query(
        "select atendimento.finalizar_conversa($1::uuid, $2::uuid, 'encerrada', $3::text, 'encerrada_por_humano')",
        [empresaId, conversaId, resumoFinal?.trim() || null],
      );
      return { id: conversaId, status: 'encerrada' as const };
    });
  }

  async resolveWhatsAppChannel(phoneNumberId: string) {
    const result = await this.db.query<{ empresa_id: string; canal_id: string; agente_id: string; provedor: string }>(
      'select * from atendimento.resolver_canal_whatsapp($1)', [phoneNumberId],
    );
    return result.rows[0] ?? null;
  }

  async resolveWahaChannel(session: string) {
    const result = await this.db.query<{ empresa_id: string; canal_id: string; agente_id: string; provedor: string }>('select * from atendimento.resolver_canal_waha($1)', [session]);
    return result.rows[0] ?? null;
  }

  private async withTenantRows(empresaId: string, text: string) {
    return this.db.withTenant(empresaId, async (client: PoolClient) => (await client.query(text)).rows);
  }

  private normalizeScriptSteps(etapas: Array<Record<string, unknown>>) {
    if (!etapas.length || etapas.length > 30) throw new BadRequestException('O roteiro deve ter entre 1 e 30 etapas');
    const ids = new Set<string>();
    return etapas.map((etapa, index) => {
      const titulo = typeof etapa.titulo === 'string' ? etapa.titulo.trim() : '';
      const objetivo = typeof etapa.objetivo === 'string' ? etapa.objetivo.trim() : '';
      const id = typeof etapa.id === 'string' && /^[a-z0-9-]{2,80}$/.test(etapa.id) ? etapa.id : `etapa-${index + 1}`;
      if (!titulo || !objetivo || titulo.length > 160 || objetivo.length > 2000 || ids.has(id)) throw new BadRequestException('Cada etapa exige identificador único, título e objetivo');
      ids.add(id);
      return { id, titulo, objetivo, instrucoes: typeof etapa.instrucoes === 'string' ? etapa.instrucoes.trim() : '', criterios_avanco: typeof etapa.criterios_avanco === 'string' ? etapa.criterios_avanco.trim() : '', criterios_transferencia: typeof etapa.criterios_transferencia === 'string' ? etapa.criterios_transferencia.trim() : '' };
    });
  }

  private async ensureAgentBelongsToTenant(client: PoolClient, empresaId: string, agentId: string) {
    const agent = await client.query('select id from atendimento.agentes where id=$1 and empresa_id=$2 and ativo', [agentId, empresaId]);
    if (!agent.rows[0]) throw new NotFoundException('Agente ativo não encontrado para a empresa');
  }

  private async resolveOutgoingChannel(client: PoolClient, empresaId: string, canal: string, configuredChannelId: string | null): Promise<{ id: string; provedor: 'waha' } | null> {
    if (canal !== 'whatsapp') return null;
    if (configuredChannelId && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(configuredChannelId)) {
      const selected = await client.query<{ id: string; provedor: 'waha' }>("select id, provedor from atendimento.canais_whatsapp where id=$1 and empresa_id=$2 and ativo and provedor='waha'", [configuredChannelId, empresaId]);
      if (selected.rows[0]) return selected.rows[0];
    }
    const candidates = await client.query<{ id: string; provedor: 'waha' }>("select id, provedor from atendimento.canais_whatsapp where empresa_id=$1 and ativo and provedor='waha' order by created_at asc limit 2", [empresaId]);
    return candidates.rows.length === 1 ? candidates.rows[0] : null;
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
      const channel = await client.query<{ sessao_waha: string | null }>(
        "select sessao_waha from atendimento.canais_whatsapp where id=$1 and empresa_id=$2 and ativo and provedor='waha'",
        [claimed.rows[0].canal_whatsapp_id, empresaId],
      );
      return { ...claimed.rows[0], channel: channel.rows[0] ?? null };
    });
    if (!delivery || !('channel' in delivery) || !delivery.channel?.sessao_waha) {
      await this.failDelivery(empresaId, deliveryId, 'CANAL_NAO_CONFIGURADO', 'Canal WAHA ativo indisponível');
      return 'falha';
    }
    try {
      const providerMessageId = await this.waha.sendText(delivery.channel.sessao_waha, delivery.contato_externo, delivery.conteudo);
      await this.db.withTenant(empresaId, async (client) => {
        await client.query("update atendimento.entregas_mensagens set status='enviada', provedor_mensagem_id=$3, enviada_em=now() where id=$1 and empresa_id=$2", [deliveryId, empresaId, providerMessageId]);
      });
      return 'enviada';
    } catch {
      await this.failDelivery(empresaId, deliveryId, 'WAHA_INDISPONIVEL', 'Falha de rede ao comunicar com WAHA');
      return 'falha';
    }
  }

  private async failDelivery(empresaId: string, deliveryId: string, code: string, detail: string) {
    await this.db.withTenant(empresaId, async (client) => {
      await client.query("update atendimento.entregas_mensagens set status='falha', erro_codigo=$3, erro_detalhe=left($4, 2000), proxima_tentativa_em=now() + interval '5 minutes' where id=$1 and empresa_id=$2", [deliveryId, empresaId, code, detail]);
    });
  }
}
