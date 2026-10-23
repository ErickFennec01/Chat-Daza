# Spec 03 — contratos de API

## Fronteiras de autenticação

| Chamada | Autenticação | Quem chama |
|---|---|---|
| Administração de tenant | `X-DAZA-Admin-Key` | operação interna DAZA |
| Painel de uma empresa | `Authorization: Bearer daza_<prefixo>_<segredo>` | Next.js/BFF |
| Meta webhook | verificação Meta + assinatura HMAC | Meta Cloud API |
| Decisão do agente | `X-DAZA-Internal-Key` | n8n privado |

## Endpoints MVP

### Administração interna

- `POST /v1/admin/empresas` — cria tenant.
- `POST /v1/admin/empresas/{empresaId}/api-keys` — emite token exibido uma única vez.

### Painel tenant

- `GET|POST|PATCH /v1/agentes`
- `GET|POST|PATCH /v1/conhecimento/documentos`
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
