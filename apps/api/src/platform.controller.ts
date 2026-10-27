import { Body, Controller, Delete, Get, Headers, HttpCode, Logger, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AgentDecisionDto, AssignAgentScriptDto, CloseConversationDto, CreateApiKeyDto, CreateDocumentoDto, CreateEmpresaDto, CreateQueueDto, CreateSimulationDto, CreateUserDto, CreateWhatsAppChannelDto, ListConversationsQueryDto, LoginDto, ResolveQuestionDto, SendHumanMessageDto, SendSimulationMessageDto, TransferConversationDto, UpdateDocumentoDto, UpdateOperationPolicyDto, UpdateQueueDto, UpdateWhatsAppChannelDto, UpsertAgentDto, UpsertScriptDto } from './dto';
import { AppService } from './platform.service';
import { requireAdminKey, requireInternalKey, requirePanelAdmin, TenantGuard, TenantRequest } from './tenant.guard';
import { AuthService } from './auth.service';

type MetaPayload = {
  entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string }; messages?: Array<{ id?: string; from?: string; text?: { body?: string } }> } }> }>;
};
type WahaPayload = { event?: string; session?: string; payload?: { id?: string; from?: string; body?: string; fromMe?: boolean | 'true' | 'false' } };
type RequestWithRawBody = Request & { rawBody?: Buffer };

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  constructor(private readonly service: AppService, private readonly auth: AuthService) {}

  @Get('healthz')
  health() { return this.service.health(); }

  @Post('admin/empresas')
  createEmpresa(@Headers('x-daza-admin-key') key: string | undefined, @Body() input: CreateEmpresaDto) {
    requireAdminKey(key);
    return this.service.createEmpresa(input);
  }

  @Post('admin/empresas/:empresaId/api-keys')
  createApiKey(@Headers('x-daza-admin-key') key: string | undefined, @Param('empresaId') empresaId: string, @Body() input: CreateApiKeyDto) {
    requireAdminKey(key);
    return this.service.createApiKey(empresaId, input);
  }

  @Post('admin/empresas/:empresaId/usuarios')
  createPanelUser(@Headers('x-daza-admin-key') key: string | undefined, @Param('empresaId') empresaId: string, @Body() input: CreateUserDto) {
    requireAdminKey(key);
    return this.service.createPanelUser(empresaId, input);
  }

  @Post('auth/login')
  @HttpCode(200)
  login(@Body() input: LoginDto) { return this.auth.login(input.email, input.senha); }

  @UseGuards(TenantGuard)
  @Get('me')
  me(@Req() request: TenantRequest) {
    return request.session
      ? { usuario: request.session }
      : { empresaId: request.empresaId, autenticacao: 'api_key' };
  }

  @UseGuards(TenantGuard)
  @Get('agentes')
  listAgents(@Req() request: TenantRequest) { return this.service.listAgents(request.empresaId!); }

  @UseGuards(TenantGuard)
  @Get('laboratorio/simulacoes')
  listSimulations(@Req() request: TenantRequest) { return this.service.listSimulations(request.empresaId!); }

  @UseGuards(TenantGuard)
  @Post('laboratorio/simulacoes')
  createSimulation(@Req() request: TenantRequest, @Body() input: CreateSimulationDto) {
    if (!request.session) throw new UnauthorizedException('Ação disponível apenas para usuários do painel');
    return this.service.createSimulation(request.empresaId!, request.session.usuarioId, input);
  }

  @UseGuards(TenantGuard)
  @Get('laboratorio/simulacoes/:id')
  getSimulation(@Req() request: TenantRequest, @Param('id') id: string) { return this.service.getSimulation(request.empresaId!, id); }

  @UseGuards(TenantGuard)
  @Post('laboratorio/simulacoes/:id/mensagens')
  sendSimulationMessage(@Req() request: TenantRequest, @Param('id') id: string, @Body() input: SendSimulationMessageDto) {
    if (!request.session) throw new UnauthorizedException('Ação disponível apenas para usuários do painel');
    return this.service.sendSimulationMessage(request.empresaId!, id, input.conteudo);
  }

  @UseGuards(TenantGuard)
  @Post('agentes')
  upsertAgent(@Req() request: TenantRequest, @Body() input: UpsertAgentDto) {
    requirePanelAdmin(request);
    return this.service.upsertAgent(request.empresaId!, input);
  }

  @UseGuards(TenantGuard)
  @Patch('agentes/:id')
  updateAgent(@Req() request: TenantRequest, @Param('id') id: string, @Body() input: UpsertAgentDto) {
    requirePanelAdmin(request);
    return this.service.upsertAgent(request.empresaId!, { ...input, id });
  }

  @UseGuards(TenantGuard)
  @Patch('agentes/:id/roteiro')
  assignAgentScript(@Req() request: TenantRequest, @Param('id') id: string, @Body() input: AssignAgentScriptDto) {
    requirePanelAdmin(request);
    return this.service.assignAgentScript(request.empresaId!, id, input.roteiroId ?? null);
  }

  @UseGuards(TenantGuard)
  @Delete('agentes/:id')
  deactivateAgent(@Req() request: TenantRequest, @Param('id') id: string) {
    requirePanelAdmin(request);
    return this.service.deactivateAgent(request.empresaId!, id);
  }

  @UseGuards(TenantGuard)
  @Get('roteiros')
  listScripts(@Req() request: TenantRequest) { return this.service.listScripts(request.empresaId!); }

  @UseGuards(TenantGuard)
  @Post('roteiros')
  createScript(@Req() request: TenantRequest, @Body() input: UpsertScriptDto) { requirePanelAdmin(request); return this.service.upsertScript(request.empresaId!, input); }

  @UseGuards(TenantGuard)
  @Patch('roteiros/:id')
  updateScript(@Req() request: TenantRequest, @Param('id') id: string, @Body() input: UpsertScriptDto) { requirePanelAdmin(request); return this.service.upsertScript(request.empresaId!, input, id); }

  @UseGuards(TenantGuard)
  @Get('conhecimento/documentos')
  listDocuments(@Req() request: TenantRequest) { return this.service.listDocuments(request.empresaId!); }

  @UseGuards(TenantGuard)
  @Post('conhecimento/documentos')
  createDocument(@Req() request: TenantRequest, @Body() input: CreateDocumentoDto) {
    requirePanelAdmin(request);
    return this.service.createDocument(request.empresaId!, input);
  }

  @UseGuards(TenantGuard)
  @Patch('conhecimento/documentos/:id')
  updateDocument(@Req() request: TenantRequest, @Param('id') id: string, @Body() input: UpdateDocumentoDto) {
    requirePanelAdmin(request);
    return this.service.updateDocument(request.empresaId!, id, input);
  }

  @UseGuards(TenantGuard)
  @Delete('conhecimento/documentos/:id')
  deleteDocument(@Req() request: TenantRequest, @Param('id') id: string) {
    requirePanelAdmin(request);
    return this.service.deleteDocument(request.empresaId!, id);
  }

  @UseGuards(TenantGuard)
  @Get('perguntas-sem-resposta')
  listUnknownQuestions(@Req() request: TenantRequest) { return this.service.listUnknownQuestions(request.empresaId!); }

  @UseGuards(TenantGuard)
  @Patch('perguntas-sem-resposta/:id')
  resolveUnknownQuestion(@Req() request: TenantRequest, @Param('id') id: string, @Body() input: ResolveQuestionDto) {
    requirePanelAdmin(request);
    return this.service.resolveUnknownQuestion(request.empresaId!, id, input);
  }

  @UseGuards(TenantGuard)
  @Get('conversas')
  listConversations(@Req() request: TenantRequest, @Query() query: ListConversationsQueryDto) {
    return this.service.listConversations(request.empresaId!, query);
  }

  @UseGuards(TenantGuard)
  @Get('conversas/filas-disponiveis')
  listTransferQueues(@Req() request: TenantRequest) { return this.service.listTransferQueues(request.empresaId!); }

  @UseGuards(TenantGuard)
  @Get('conversas/:id')
  getConversation(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.service.getConversation(request.empresaId!, id);
  }

  @UseGuards(TenantGuard)
  @Post('conversas/:id/assumir')
  assumeConversation(@Req() request: TenantRequest, @Param('id') id: string) {
    if (!request.session) throw new UnauthorizedException('Ação disponível apenas para usuários do painel');
    return this.service.assumeConversation(request.empresaId!, id, request.session.usuarioId);
  }

  @UseGuards(TenantGuard)
  @Post('conversas/:id/transferir')
  transferConversation(@Req() request: TenantRequest, @Param('id') id: string, @Body() input: TransferConversationDto) {
    if (!request.session) throw new UnauthorizedException('Ação disponível apenas para usuários do painel');
    return this.service.transferConversation(request.empresaId!, id, input.filaId, request.session.usuarioId, request.session.papel === 'admin', input.motivo);
  }

  @UseGuards(TenantGuard)
  @Post('conversas/:id/mensagens')
  sendHumanMessage(@Req() request: TenantRequest, @Param('id') id: string, @Body() input: SendHumanMessageDto) {
    if (!request.session) throw new UnauthorizedException('Ação disponível apenas para usuários do painel');
    return this.service.sendHumanMessage(request.empresaId!, id, request.session.usuarioId, input.conteudo);
  }

  @UseGuards(TenantGuard)
  @Post('conversas/:id/encerrar')
  closeConversation(@Req() request: TenantRequest, @Param('id') id: string, @Body() input: CloseConversationDto) {
    if (!request.session) throw new UnauthorizedException('Ação disponível apenas para usuários do painel');
    return this.service.closeConversation(request.empresaId!, id, request.session.usuarioId, request.session.papel === 'admin', input.resumoFinal);
  }

  @UseGuards(TenantGuard)
  @Get('operacao/politica')
  getOperationPolicy(@Req() request: TenantRequest) { requirePanelAdmin(request); return this.service.getOperationPolicy(request.empresaId!); }

  @UseGuards(TenantGuard)
  @Patch('operacao/politica')
  updateOperationPolicy(@Req() request: TenantRequest, @Body() input: UpdateOperationPolicyDto) { requirePanelAdmin(request); return this.service.updateOperationPolicy(request.empresaId!, input); }

  @UseGuards(TenantGuard)
  @Get('operacao/filas')
  listQueues(@Req() request: TenantRequest) { requirePanelAdmin(request); return this.service.listQueues(request.empresaId!); }

  @UseGuards(TenantGuard)
  @Post('operacao/filas')
  createQueue(@Req() request: TenantRequest, @Body() input: CreateQueueDto) { requirePanelAdmin(request); return this.service.createQueue(request.empresaId!, input); }

  @UseGuards(TenantGuard)
  @Patch('operacao/filas/:id')
  updateQueue(@Req() request: TenantRequest, @Param('id') id: string, @Body() input: UpdateQueueDto) { requirePanelAdmin(request); return this.service.updateQueue(request.empresaId!, id, input); }

  @UseGuards(TenantGuard)
  @Get('metricas')
  metrics(@Req() request: TenantRequest) { return this.service.metrics(request.empresaId!); }

  @UseGuards(TenantGuard)
  @Get('operacao/entregas-falhas')
  listFailedDeliveries(@Req() request: TenantRequest) {
    requirePanelAdmin(request);
    return this.service.listFailedDeliveries(request.empresaId!);
  }

  @UseGuards(TenantGuard)
  @Get('operacao/fila-sla')
  listQueueSla(@Req() request: TenantRequest) {
    requirePanelAdmin(request);
    return this.service.listQueueSla(request.empresaId!);
  }

  @UseGuards(TenantGuard)
  @Post('operacao/entregas/:id/reprocessar')
  retryDelivery(@Req() request: TenantRequest, @Param('id') id: string) {
    requirePanelAdmin(request);
    return this.service.retryDelivery(request.empresaId!, id, request.session!.usuarioId);
  }

  @UseGuards(TenantGuard)
  @Get('canais/whatsapp')
  listWhatsAppChannels(@Req() request: TenantRequest) { return this.service.listWhatsAppChannels(request.empresaId!); }

  @UseGuards(TenantGuard)
  @Post('canais/whatsapp')
  createWhatsAppChannel(@Req() request: TenantRequest, @Body() input: CreateWhatsAppChannelDto) {
    requirePanelAdmin(request);
    return this.service.createWhatsAppChannel(request.empresaId!, input);
  }

  @UseGuards(TenantGuard)
  @Patch('canais/whatsapp/:id')
  updateWhatsAppChannel(@Req() request: TenantRequest, @Param('id') id: string, @Body() input: UpdateWhatsAppChannelDto) {
    requirePanelAdmin(request);
    return this.service.updateWhatsAppChannel(request.empresaId!, id, input);
  }

  @UseGuards(TenantGuard)
  @Delete('canais/whatsapp/:id')
  deactivateWhatsAppChannel(@Req() request: TenantRequest, @Param('id') id: string) {
    requirePanelAdmin(request);
    return this.service.deactivateWhatsAppChannel(request.empresaId!, id);
  }

  @UseGuards(TenantGuard)
  @Post('canais/whatsapp/:id/conectar')
  connectWhatsAppChannel(@Req() request: TenantRequest, @Param('id') id: string) {
    requirePanelAdmin(request);
    return this.service.connectWhatsAppChannel(request.empresaId!, id);
  }

  @UseGuards(TenantGuard)
  @Get('canais/whatsapp/:id/status')
  getWhatsAppChannelStatus(@Req() request: TenantRequest, @Param('id') id: string) {
    requirePanelAdmin(request);
    return this.service.getWhatsAppChannelStatus(request.empresaId!, id);
  }

  @Post('webhooks/waha/whatsapp')
  @HttpCode(200)
  async receiveWahaWebhook(@Headers('x-daza-waha-webhook') key: string | undefined, @Body() payload: WahaPayload) {
    this.assertWahaWebhookKey(key);
    const body = payload.payload?.body?.trim();
    const from = payload.payload?.from ?? '';
    const ignoreReason = this.wahaIgnoreReason(payload, body, from);
    if (ignoreReason) {
      this.logger.warn(`Evento WAHA ignorado: ${ignoreReason}`);
      return { recebido: true, ignorado: true };
    }
    const channel = await this.service.resolveWahaChannel(payload.session!);
    if (!channel) {
      this.logger.warn('Evento WAHA ignorado: canal_inexistente');
      return { recebido: true, ignorado: true };
    }
    const remetente = from.replace(/@s\.whatsapp\.net$/, '@c.us');
    void this.dispatchToN8n({
      canal: 'whatsapp', destinatario: payload.session!, remetente, id_externo: payload.payload!.id!, mensagem: body!,
      metadados: { canal_id: channel.canal_id, agente_id: channel.agente_id, provedor: 'waha' },
    });
    return { recebido: true };
  }

  @Get('webhooks/meta/whatsapp')
  verifyMetaWebhook(@Query() query: Record<string, string>) {
    if (query['hub.mode'] !== 'subscribe' || query['hub.verify_token'] !== process.env.META_VERIFY_TOKEN) throw new UnauthorizedException();
    return query['hub.challenge'];
  }

  @Post('webhooks/meta/whatsapp')
  @HttpCode(200)
  async receiveMetaWebhook(@Req() request: RequestWithRawBody, @Headers('x-hub-signature-256') signature: string | undefined, @Body() payload: MetaPayload) {
    this.assertMetaSignature(request.rawBody, signature);
    const events = this.extractMetaEvents(payload);
    for (const event of events) {
      const channel = await this.service.resolveWhatsAppChannel(event.phoneNumberId);
      if (!channel) continue;
      void this.dispatchToN8n({
        canal: 'whatsapp', destinatario: event.phoneNumberId, remetente: event.from, id_externo: event.id, mensagem: event.text,
        metadados: { canal_id: channel.canal_id, agente_id: channel.agente_id, provedor: channel.provedor },
      });
    }
    return { recebido: true };
  }

  @Post('internal/decisoes-agente')
  @HttpCode(202)
  processAgentDecision(@Headers('x-daza-internal-key') key: string | undefined, @Body() decision: AgentDecisionDto) {
    requireInternalKey(key);
    return this.service.processAgentDecision({
      empresaId: decision.empresaId ?? decision.empresa_id!,
      conversaId: decision.conversaId ?? decision.conversa_id!,
      acao: decision.acao,
      resposta: decision.resposta,
      modelo: decision.modelo,
      ragCache: decision.ragCache ?? decision.rag_cache,
      motivoEscalonamento: decision.motivoEscalonamento ?? decision.motivo_escalonamento,
    });
  }

  private assertMetaSignature(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = process.env.META_APP_SECRET;
    if (!secret || !rawBody || !signature?.startsWith('sha256=')) throw new UnauthorizedException('Assinatura Meta ausente');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const actual = signature.slice(7);
    if (actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) throw new UnauthorizedException('Assinatura Meta inválida');
  }

  private assertWahaWebhookKey(received: string | undefined) {
    const expected = process.env.WAHA_WEBHOOK_SECRET;
    if (!expected || !received || expected.length !== received.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(received))) throw new UnauthorizedException('Webhook WAHA inválido');
  }

  private wahaIgnoreReason(payload: WahaPayload, body: string | undefined, from: string): string | null {
    if (payload.event !== 'message') return 'evento_nao_suportado';
    if (payload.payload?.fromMe === true || payload.payload?.fromMe === 'true') return 'mensagem_propria';
    if (!payload.session) return 'sessao_ausente';
    if (!payload.payload?.id) return 'id_externo_ausente';
    if (!body) return 'texto_ausente';
    if (!/^[0-9]+@(c\.us|s\.whatsapp\.net|lid)$/.test(from)) return `origem_invalida:${from.includes('@') ? from.slice(from.lastIndexOf('@')) : 'ausente'}`;
    return null;
  }

  private extractMetaEvents(payload: MetaPayload) {
    const events: Array<{ phoneNumberId: string; id: string; from: string; text: string }> = [];
    for (const entry of payload.entry ?? []) for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      for (const message of value?.messages ?? []) {
        const text = message.text?.body?.trim();
        if (phoneNumberId && message.id && message.from && text) events.push({ phoneNumberId, id: message.id, from: message.from, text });
      }
    }
    return events;
  }

  private async dispatchToN8n(event: Record<string, unknown>) {
    const url = process.env.N8N_AGENT_WEBHOOK_URL;
    const secret = process.env.N8N_WEBHOOK_SECRET;
    if (!url || !secret) return;
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-daza-internal-key': secret }, body: JSON.stringify(event), signal: AbortSignal.timeout(15_000) });
      if (!response.ok) this.logger.error(`Entrega ao n8n rejeitada: http_${response.status}`);
    } catch {
      this.logger.error('Entrega ao n8n indisponível');
    }
  }
}
