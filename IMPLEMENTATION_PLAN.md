# Plano de implementação — MVP DAZA Atendimento

## Fase 0 — especificações e fundação

- [x] Escolher Node.js/NestJS, Next.js, PostgreSQL, Redis, n8n e Meta Cloud.
- [x] Definir contratos, isolamento e critérios de aceite em `specs/`.
- [ ] Revisar/validar as specs antes de publicar integrações externas.

## Fase 1 — banco e segurança

1. Revisar e aplicar migration `08-plataforma-whatsapp.sql` em `db_atendimento`.
2. Criar papel PostgreSQL de menor privilégio `daza_atendimento_app`.
3. Criar segredo de ambiente para API, chaves internas e cifra de token Meta.
4. Testar RLS com duas empresas reais de homologação.

**Entregável:** banco com agentes, canais, perguntas pendentes e isolamento testado.

## Fase 2 — API NestJS

1. Implementar configuração tipada, pool PostgreSQL e Redis.
2. Implementar autenticação administrativa, token de tenant e `app.empresa_id` transacional.
3. Implementar CRUD de agente, documentos, perguntas e conversas.
4. Implementar adaptador Meta (verificação, assinatura e normalização).
5. Implementar endpoint interno de decisão do n8n e envio Meta.

**Entregável:** API documentada e testes automatizados de tenant/idempotência.

## Fase 3 — painel Next.js

1. Tela de agente: modelo, system prompt, limites e ativação.
2. Tela de conhecimento: documentos e status de indexação.
3. Tela de dúvidas pendentes: resposta curada e descarte.
4. Tela de conversas: histórico e assumir atendimento.
5. Tela de canal: status e instruções de webhook Meta.

**Entregável:** empresa administra seu agente sem acessar infraestrutura.

## Fase 4 — workflow n8n enxuto

1. Substituir os protótipos por um único fluxo de até 10 nós.
2. Associar credenciais internas, Redis e OpenRouter sem segredos no JSON.
3. Validar os três cenários: válido, inválido e duplicado.
4. Manter inativo até a homologação do número Meta.

**Entregável:** workflow importável, testado isoladamente e documentado.

## Fase 5 — deploy e homologação

1. Subir API e painel pela stack Portainer, em rede interna.
2. Configurar proxy/domínio somente para API e painel necessários.
3. Cadastrar app/número de teste Meta e webhook assinado.
4. Homologar mensagem, RAG, escalonamento e resposta humana.
5. Configurar backup, logs e monitoramento.

**Entregável:** uma empresa piloto atendendo por WhatsApp com segurança.
