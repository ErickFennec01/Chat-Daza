import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AgentDecisionDto, CreateApiKeyDto, CreateDocumentoDto, CreateEmpresaDto, CreateUserDto, LoginDto, ResolveQuestionDto, UpdateDocumentoDto, UpsertAgentDto } from './dto';
import { AppService } from './platform.service';
import { requireAdminKey, requireInternalKey, TenantGuard, TenantRequest } from './tenant.guard';
import { AuthService } from './auth.service';

type MetaPayload = {
  entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string }; messages?: Array<{ id?: string; from?: string; text?: { body?: string } }> } }> }>;
};
type RequestWithRawBody = Request & { rawBody?: Buffer };

@Controller()
export class AppController {
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
  @Post('agentes')
  upsertAgent(@Req() request: TenantRequest, @Body() input: UpsertAgentDto) { return this.service.upsertAgent(request.empresaId!, input); }

  @UseGuards(TenantGuard)
  @Patch('agentes/:id')
  updateAgent(@Req() request: TenantRequest, @Param('id') id: string, @Body() input: UpsertAgentDto) {
    return this.service.upsertAgent(request.empresaId!, { ...input, id });
  }

  @UseGuards(TenantGuard)
  @Delete('agentes/:id')
  deactivateAgent(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.service.deactivateAgent(request.empresaId!, id);
  }

  @UseGuards(TenantGuard)
  @Get('conhecimento/documentos')
  listDocuments(@Req() request: TenantRequest) { return this.service.listDocuments(request.empresaId!); }

  @UseGuards(TenantGuard)
  @Post('conhecimento/documentos')
  createDocument(@Req() request: TenantRequest, @Body() input: CreateDocumentoDto) { return this.service.createDocument(request.empresaId!, input); }

  @UseGuards(TenantGuard)
  @Patch('conhecimento/documentos/:id')
  updateDocument(@Req() request: TenantRequest, @Param('id') id: string, @Body() input: UpdateDocumentoDto) {
    return this.service.updateDocument(request.empresaId!, id, input);
  }

  @UseGuards(TenantGuard)
  @Delete('conhecimento/documentos/:id')
  deleteDocument(@Req() request: TenantRequest, @Param('id') id: string) {
    return this.service.deleteDocument(request.empresaId!, id);
  }

  @UseGuards(TenantGuard)
  @Get('perguntas-sem-resposta')
  listUnknownQuestions(@Req() request: TenantRequest) { return this.service.listUnknownQuestions(request.empresaId!); }

  @UseGuards(TenantGuard)
  @Patch('perguntas-sem-resposta/:id')
  resolveUnknownQuestion(@Req() request: TenantRequest, @Param('id') id: string, @Body() input: ResolveQuestionDto) {
    return this.service.resolveUnknownQuestion(request.empresaId!, id, input);
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
    return this.service.processAgentDecision(decision);
  }

  private assertMetaSignature(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = process.env.META_APP_SECRET;
    if (!secret || !rawBody || !signature?.startsWith('sha256=')) throw new UnauthorizedException('Assinatura Meta ausente');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const actual = signature.slice(7);
    if (actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) throw new UnauthorizedException('Assinatura Meta inválida');
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
      await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-daza-internal-key': secret }, body: JSON.stringify(event), signal: AbortSignal.timeout(15_000) });
    } catch {
      // A persistência/idempotência é tratada no banco; telemetria de retry entra na próxima fase.
    }
  }
}
