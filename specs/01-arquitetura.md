# Spec 01 — arquitetura do MVP

```text
Meta WhatsApp Cloud
      │ webhook assinado
      ▼
API DAZA (NestJS / Node.js)
  ├─ valida assinatura, canal e tenant
  ├─ persiste evento e conversa
  ├─ chama n8n por rede privada
  └─ envia a resposta ao WhatsApp
      │ evento normalizado
      ▼
n8n (um workflow de agente)
  ├─ memória no PostgreSQL
  ├─ cache/RAG no Redis
  ├─ OpenRouter
  └─ decisão estruturada
      │ decisão assinada internamente
      └──────────────► API DAZA

Painel Next.js ───────────────► API DAZA
                                  │
                             db_atendimento
```

## Stack escolhida

| Camada | Tecnologia | Responsabilidade |
|---|---|---|
| Painel | Next.js + TypeScript | administração do tenant |
| API | Node.js + NestJS | regras, autenticação, canais e isolamento |
| Dados | PostgreSQL 16 / `db_atendimento` | registros duráveis e auditoria |
| Cache | Redis existente | resultados RAG e rate limit |
| Orquestração | n8n existente | execução controlada do agente |
| IA | OpenRouter | modelo configurável por agente |
| Canal | Meta WhatsApp Cloud | entrada/saída oficial de mensagens |

## Limites de responsabilidade

- A API DAZA conhece tokens Meta e identifica a empresa.
- O n8n não conhece token Meta e não recebe credenciais de banco por empresa.
- O painel nunca fala diretamente com PostgreSQL, Redis, Meta ou OpenRouter.
- O agente só recebe contexto da empresa e devolve `responder` ou `escalar`.
