# Especificação — Permissões do n8n e contexto do agente

## Problema

O workflow usa o papel técnico `daza_atendimento_app`, mas as funções de
entrada do atendimento estavam liberadas apenas para um papel legado. A mesma
consulta também buscava `agentes` diretamente, sujeita à RLS sem contexto de
empresa no n8n.

## Regras

- O papel técnico atual recebe somente `USAGE` no schema e `EXECUTE` nas cinco
  funções requeridas pelo workflow.
- A configuração do agente é retornada por uma função `SECURITY DEFINER`,
  sempre filtrada por `empresa_id`, `agente_id` e agente ativo.
- O SQL do n8n não acessa mais a tabela `agentes` diretamente.
- A memória, que retorna uma tabela, é consumida por `LEFT JOIN LATERAL` e
  serializada no contrato esperado pelo nó de preparação do prompt.
- Nenhuma credencial ou privilégio de tabela adicional é concedido ao n8n.

## Aceite

1. O papel do n8n pode executar todas as funções do fluxo.
2. O contexto de um agente de outra empresa retorna nulo.
3. O nó PostgreSQL avança além da resolução da entrada sem erro de permissão
   ou bloqueio por RLS.
