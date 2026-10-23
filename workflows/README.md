# Workflow n8n único — DAZA Atendimento

`daza-atendimento-agente.json` é o fluxo de produção inativo para n8n 2.44.5.
Ele possui dez nós principais: entrada privada, validação, idempotência e
persistência, roteador de sessão, cache RAG Redis, recuperação RAG/PostgreSQL,
OpenRouter, validação da decisão e entrega pela API DAZA.

## Credenciais a associar no n8n

Depois de importar, associe as credenciais existentes — os segredos não estão
no JSON versionado:

| Nó | Tipo de credencial | Uso |
|---|---|---|
| `01 — Webhook interno` | Header Auth | `x-daza-internal-key` entre API e n8n |
| `03 — Resolver, deduplicar e carregar contexto` | PostgreSQL | banco `db_atendimento` |
| `05` e `07` | Redis | cache RAG privado |
| `08 — OpenRouter: decisão estruturada` | Header Auth | Bearer da OpenRouter |
| `10 — API DAZA: registrar e entregar` | Header Auth | `x-daza-internal-key` da API DAZA |

O host interno da API é `daza-atendimento-api:8000`; a stack precisa manter
esse alias na rede Docker `daza-erp_erp_net`.

## Teste antes de ativar

Use os três eventos em `fixtures/inbound-events.json` em ambiente de
homologação. O evento duplicado deve ser enviado em uma segunda execução: a
idempotência é durável no PostgreSQL, não em memória do n8n. Não ative o
workflow nem associe credenciais de produção até validar os três cenários.

Para validar localmente os eventos válido e inválido sem chamar serviços:

```powershell
node workflows/tests/validate-fixtures.mjs
```
