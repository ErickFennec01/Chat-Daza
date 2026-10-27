# Especificação — Painel de SLA e filas humanas

## Objetivo

Exibir para a liderança os atendimentos que aguardam ação humana, em ordem de
prioridade e risco de SLA, para que nenhum cliente fique sem resposta.

## Regras de negócio

- A visão inclui somente conversas `aguardando_humano` da empresa autenticada.
- O SLA efetivo é o da fila; quando ela não tiver SLA próprio, usa-se a política
  da empresa.
- A contagem começa na transferência para a fila. Para conversas humanas sem
  transferência, começa na criação da conversa.
- Um item é `atrasado` quando seu prazo venceu; `em_risco` quando restam até
  cinco minutos; os demais são `no_prazo`.
- A lista não entrega conteúdo de mensagens, apenas identificador do contato,
  fila, prioridade, responsável e prazo calculado.
- A visualização é administrativa e é calculada diretamente no PostgreSQL,
  sempre filtrada pelo `empresa_id` da sessão.

## Critérios de aceite

1. Administrador vê fila ordenada por atraso, prioridade e tempo de espera.
2. Operador não acessa a visão administrativa de SLA.
3. Empresa não vê atendimentos de outra empresa.
4. Conversas encerradas, resolvidas ou ainda com IA não aparecem.
