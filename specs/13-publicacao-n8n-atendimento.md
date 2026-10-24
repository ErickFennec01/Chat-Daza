# Spec 13 — Publicação do workflow n8n de atendimento

## Objetivo

Publicar e ativar o workflow unificado **DAZA Atendimento — Agente WhatsApp (MVP)** para receber eventos internos da API e persistir/processar o atendimento.

## Configuração obrigatória

- `01 — Webhook interno`: credencial **DAZA Atendimento — entrada n8n** (`httpHeaderAuth`).
- `03 — Resolver, deduplicar e carregar contexto`: **DAZA Atendimento — PostgreSQL**.
- `05` e `07 — Redis`: **DAZA Atendimento — Redis cache**.
- `08 — OpenRouter`: **OpenRouter account**.
- `10 — API DAZA`: **DAZA Atendimento — API interna**.
- A API usa o caminho privado `n8n/webhook/daza/atendimento/inbound`; segredos permanecem só nas credenciais do n8n e no ambiente local.

## Aceite

1. O workflow está publicado e ativo.
2. Todos os nós obrigatórios têm referências de credencial válidas no projeto DAZA Atendimento.
3. Após um evento WhatsApp válido, a automação cria ou atualiza conversa, executa o agente e registra a entrega.
