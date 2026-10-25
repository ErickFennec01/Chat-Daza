# Especificação — Preservação de contexto após o Redis

## Problema

O nó Redis de leitura retorna somente a propriedade do cache. O nó seguinte
perdia o contexto de agente, conversa e RAG carregado no PostgreSQL.

## Regra

- O nó de preparação do prompt recupera o contexto canônico no nó 03.
- Ele mescla exclusivamente `rag_cache` devolvido pelo Redis.
- O cache pode chegar como JSON serializado ou objeto já desserializado.

## Aceite

1. O contexto de agente mantém `modelo` e `system_prompt` após a consulta ao
   Redis.
2. Cache RAG válido é utilizado quando existir; caso contrário, usa RAG do
   banco.
3. Nenhuma mensagem ou dado de contato é logado pelo fluxo.
