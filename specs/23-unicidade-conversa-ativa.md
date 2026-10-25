# Uma conversa ativa por contato

## Regra de negócio

- Para uma empresa, canal e identificador externo de contato, existe no máximo uma conversa em `aberta` ou `aguardando_humano`.
- Eventos repetidos ou simultâneos do mesmo contato retornam a conversa ativa existente; não abrem outro atendimento.
- Conversas `resolvida` e `encerrada` permanecem no histórico e não bloqueiam um novo atendimento futuro.
- A regra é aplicada no PostgreSQL, não apenas no n8n ou no frontend.

## Persistência

O índice parcial único `uq_conversas__contato_ativa` é a garantia física. A função `atendimento.criar_conversa` usa inserção com conflito ignorado e recuperação da conversa já existente, eliminando erro de corrida entre webhooks.

## Critérios de aceite

- Duas chamadas concorrentes para o mesmo contato ativo resultam em um único registro.
- A segunda chamada retorna o mesmo `conversa_id` e `criada=false`.
- Após encerrar a conversa, uma nova chamada pode abrir novo atendimento.
