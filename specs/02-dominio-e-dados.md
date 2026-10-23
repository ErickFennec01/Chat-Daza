# Spec 02 — domínio e dados

## Entidades existentes que serão reutilizadas

- `empresas`: tenant DAZA.
- `conversas` e `mensagens`: sessão e histórico.
- `documentos`: conhecimento de cada empresa.
- `execucoes_agente` e `acoes_agente`: auditoria de IA.
- `eventos_entrada`: idempotência de mensagens do provedor.

## Novas entidades da migration 08

| Entidade | Finalidade |
|---|---|
| `agentes` | configuração por empresa: prompt, modelo, temperatura, limites |
| `canais_whatsapp` | vínculo do número Meta a um agente; token cifrado apenas no backend |
| `perguntas_sem_resposta` | backlog de dúvidas que exigem conhecimento ou humano |
| `api_chaves` | credenciais de acesso do painel/API do tenant, armazenadas somente como hash |

## Isolamento

1. O token autenticado resolve um único `empresa_id` no backend.
2. A API abre transação e define `app.empresa_id`.
3. Row-level security limita tabelas da plataforma a esse valor.
4. As funções de borda (`autenticar_api_chave` e `resolver_canal_whatsapp`) são as únicas exceções controladas, usadas antes de existir tenant na transação.

## Ciclo de uma dúvida

1. O agente não encontra contexto suficiente ou pede escalonamento.
2. A API grava `perguntas_sem_resposta` como `aberta`.
3. Operador cria/atualiza documento e marca a dúvida `respondida`.
4. A versão de conhecimento é incrementada e o cache RAG fica inválido.
