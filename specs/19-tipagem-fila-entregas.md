# Especificação — Tipagem da fila de entregas

## Problema

O `INSERT` de `entregas_mensagens` usa o parâmetro do canal tanto como UUID
quanto em `IS NULL`. Sem um cast, o PostgreSQL não consegue inferir seu tipo
na consulta preparada usada pela API.

## Regra

- Os identificadores da fila são explicitamente `uuid` e o provedor é `text`.
- A mesma tipagem é usada na condição que define entrega pendente ou falha.
- O fluxo mantém a transação: persiste saída, enfileira e somente então tenta
  a entrega WAHA.

## Aceite

1. O statement pode ser preparado pelo PostgreSQL.
2. Uma decisão `responder` deixa de retornar HTTP 500 na API interna.
3. O teste unitário verifica o cast do identificador de canal.
