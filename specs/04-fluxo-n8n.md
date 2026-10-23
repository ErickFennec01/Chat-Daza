# Spec 04 — workflow único n8n

O workflow de produção terá no máximo 10 nós principais:

1. Webhook interno `inbound`.
2. Validar origem e campos obrigatórios.
3. Resolver empresa/canal/conversa e deduplicar evento.
4. Gravar mensagem de entrada.
5. Carregar memória e configuração do agente.
6. Buscar RAG no Redis; em falta, recuperar no PostgreSQL e gravar cache.
7. Chamar OpenRouter com saída estruturada.
8. Registrar resposta, uso e decisão.
9. Chamar `POST /v1/internal/decisoes-agente` na API DAZA.
10. Responder `202` à API.

## Regras

- Webhook permanece desativado até homologação.
- `id_externo` é obrigatório e tem unicidade durável.
- Não há token Meta, token do banco ou segredo de cliente em nós/expressões.
- Falha de modelo resulta em decisão `escalar`; não há resposta inventada.
