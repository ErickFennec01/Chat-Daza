# Especificação — Roteiros de atendimento

## Objetivo

Permitir que cada empresa configure roteiros para orientar agentes de IA por
etapas e controlar transferências ao atendimento humano.

## Modelo inicial

- Um roteiro pertence a uma empresa e possui etapas ordenadas em JSONB.
- Cada etapa contém `id`, `titulo`, `objetivo`, `instrucoes`,
  `criterios_avanco` e `criterios_transferencia`.
- Um agente pode apontar para um roteiro ativo.
- Cada conversa guarda o roteiro vinculado, a etapa atual e o motivo de
  transferência, sem sobrescrever o histórico de mensagens.

## Regras

- Toda leitura e escrita é escopada por `empresa_id` e protegida por RLS.
- O n8n acessa o roteiro por função `SECURITY DEFINER`, não por leitura direta
  de tabelas.
- Transferência ocorre apenas por decisão validada do agente ou regra futura
  de etapa; uma conversa transferida não volta automaticamente à IA.

## Critérios de aceite da fundação

1. A migração cria estruturas, índices e políticas sem afetar conversas atuais.
2. Roteiros podem ser vinculados a agentes por chave estrangeira.
3. O contexto seguro do roteiro pode ser recuperado pelo n8n para um agente da
   mesma empresa, e retorna nulo para empresas diferentes.
