# Spec 03 — contratos de API

## Fronteiras de autenticação

| Chamada | Autenticação | Quem chama |
|---|---|---|
| Administração de tenant | `X-DAZA-Admin-Key` | operação interna DAZA |
| Login do painel | e-mail e senha bcrypt | Next.js/BFF |
| Painel de uma empresa | `Authorization: Bearer <sessão JWT>` | BFF; o browser usa cookie `HttpOnly` |
| Integração programática | `Authorization: Bearer daza_<prefixo>_<segredo>` | sistema autorizado da empresa |
| Meta webhook | verificação Meta + assinatura HMAC | Meta Cloud API |
| Decisão do agente | `X-DAZA-Internal-Key` | n8n privado |

## Endpoints MVP

### Administração interna

- `POST /v1/admin/empresas` — cria tenant.
- `POST /v1/admin/empresas/{empresaId}/api-keys` — emite token exibido uma única vez.
- `POST /v1/admin/empresas/{empresaId}/usuarios` — cria usuário humano do painel.
- `POST /v1/auth/login` — autentica e devolve sessão assinada ao BFF.

### Painel tenant

- `GET|POST /v1/agentes`, `PATCH|DELETE /v1/agentes/{id}`
- `GET|POST /v1/conhecimento/documentos`, `PATCH|DELETE /v1/conhecimento/documentos/{id}`
- `GET|PATCH /v1/perguntas-sem-resposta`
- `GET /v1/conversas`
- `GET /v1/metricas`
- `GET|POST|PATCH /v1/canais/whatsapp`

### Integrações

- `GET /v1/webhooks/meta/whatsapp` — verificação inicial do webhook Meta.
- `POST /v1/webhooks/meta/whatsapp` — evento recebido, assinado.
- `POST /v1/internal/decisoes-agente` — retorno estruturado do n8n.

## Contrato normalizado API → n8n

```json
{
  "canal": "whatsapp",
  "destinatario": "PHONE_NUMBER_ID_META",
  "remetente": "5511999999999",
  "id_externo": "wamid.xxx",
  "mensagem": "Quero saber o horário de atendimento",
  "metadados": { "canal_id": "uuid", "agente_id": "uuid" }
}
```

## Contrato n8n → API

```json
{
  "empresa_id": "uuid",
  "conversa_id": "uuid",
  "acao": "responder|escalar",
  "resposta": "Texto destinado ao cliente",
  "motivo_escalonamento": "opcional",
  "modelo": "provedor/modelo",
  "uso": { "entrada": 0, "saida": 0 },
  "rag_cache": false
}
```

A API valida a conversa antes de enviar a resposta para o canal.
