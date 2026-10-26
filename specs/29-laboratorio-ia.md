# Spec 29 — Laboratório de IA

## Objetivo

Testar um agente com o mesmo prompt, roteiro, modelo e RAG da empresa sem
enviar mensagens ao WhatsApp ou alterar atendimentos reais.

## Isolamento

- Sessões e mensagens de teste usam `simulacoes_agente` e
  `simulacoes_mensagens`, sempre escopadas por `empresa_id`.
- O laboratório não lê nem grava `conversas`, `entregas_mensagens`, WAHA ou
  n8n.
- O histórico entregue ao modelo contém somente mensagens da própria simulação.
- O RAG é recuperado da base ativa da mesma empresa.

## Configuração

- A API usa `OPENROUTER_API_KEY` exclusivamente no servidor.
- A chave nunca é enviada ao navegador, gravada no banco ou incluída em logs.
- Sem a chave, a API retorna indisponibilidade explícita e não persiste uma
  resposta fictícia.

## Aceite

1. Usuário do tenant cria e lê apenas as próprias simulações.
2. Mensagem simulada não cria entrega WhatsApp, conversa ou fila humana.
3. O prompt inclui o roteiro ativo do agente e RAG do tenant.
4. Nenhum segredo aparece na resposta da API ou no painel.
