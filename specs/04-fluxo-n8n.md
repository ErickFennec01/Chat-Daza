# Spec 04 — workflow único n8n

O workflow de produção é versionado em `workflows/daza-atendimento-agente.json`
e tem exatamente 10 nós principais:

1. Webhook interno `inbound`.
2. Validar origem e campos obrigatórios.
3. Resolver empresa/canal/conversa, deduplicar, gravar a entrada e carregar contexto PostgreSQL.
4. `Switch` de sessão: duplicada e fila humana param antes da IA; somente a fila de agente segue.
5. Buscar RAG no Redis.
6. Montar prompt com memória, configuração do agente e fallback RAG do PostgreSQL.
7. Gravar RAG no Redis por 15 minutos.
8. Chamar OpenRouter com contrato JSON estruturado.
9. Validar a decisão; qualquer resposta inválida vira escalonamento humano.
10. Chamar `POST /v1/internal/decisoes-agente` na API DAZA, que registra e entrega pela Meta.

## Regras

- Webhook permanece desativado até homologação.
- `id_externo` é obrigatório e tem unicidade durável.
- Não há token Meta, token do banco ou segredo de cliente em nós/expressões.
- Falha de modelo resulta em decisão `escalar`; não há resposta inventada.
- O webhook devolve recebimento imediato; a Meta não fica aguardando IA.
- As credenciais são associadas no n8n após a importação e o workflow permanece inativo até homologação.
