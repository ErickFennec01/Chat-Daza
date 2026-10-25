# Encerramento do atendimento humano

## Regras de negócio

- O encerramento preserva conversa, mensagens e entregas para auditoria; não há exclusão.
- Uma conversa aberta ou aguardando humano passa para o estado terminal `encerrada`.
- O operador só pode encerrar uma conversa que esteja atribuída a ele; o administrador da mesma empresa pode encerrar qualquer conversa ativa.
- O painel pode enviar um resumo opcional. O backend deriva empresa, usuário e papel exclusivamente da sessão autenticada.
- Uma conversa encerrada não recebe nova resposta humana. Um novo evento do cliente será tratado pelo fluxo de entrada conforme a política já existente.

## Persistência

Reutiliza `atendimento.conversas` e a função transacional existente `atendimento.finalizar_conversa`, que preenche `encerrada_at`, `resumo_final`, `codigo_resolucao` e atualiza o estado. Não são necessárias tabelas nem migração nova.

## Critérios de aceite

- O endpoint exige sessão de painel e impede fechar atendimento de outro operador.
- O painel mostra a ação somente para uma conversa humana assumida e, após sucesso, atualiza histórico e lista.
- O histórico continua consultável depois do encerramento.
- Há testes para autorização e escopo do tenant.
