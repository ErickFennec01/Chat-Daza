# Especificação — Resiliência de entregas WhatsApp

## Objetivo

Dar visibilidade operacional às mensagens de saída que não chegaram ao
provedor e permitir que um administrador as reenvie sem duplicar registros ou
atravessar empresas.

## Regras de negócio

- A caixa de saída existente (`atendimento.entregas_mensagens`) continua sendo a
  fonte de verdade; não haverá uma segunda fila em Redis.
- Apenas entregas com status `falha` podem ser reprocessadas manualmente.
- O reprocessamento é permitido até cinco tentativas. Cada tentativa é
  persistida antes da chamada ao WAHA.
- Ação de reprocessar é exclusiva de administradores e fica auditada, sem
  registrar o conteúdo da mensagem na auditoria.
- Listagem e reprocessamento são sempre filtrados pelo `empresa_id` da sessão.
- Não há reenvio automático nesta fase: a operação vê a falha e toma a decisão
  explícita, evitando mensagens duplicadas enquanto o provedor estiver instável.

## Dados

- Índice por empresa, status e próxima tentativa na caixa de saída para suportar
  a fila operacional.
- Usa os campos existentes de tentativa, erro, data de próxima tentativa e
  mensagem do provedor.

## Critérios de aceite

1. Um administrador vê as entregas falhas da própria empresa, sem conteúdo de
   mensagem ou dados de outra empresa.
2. Um administrador pode reenviar uma falha abaixo do limite; a tentativa e a
   auditoria são gravadas.
3. Operador não pode reenviar entregas.
4. Uma entrega enviada ou que atingiu cinco tentativas não pode ser reenviada.
