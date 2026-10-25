# Especificação — Entrega interna ao n8n

## Objetivo

Garantir que cada evento WhatsApp aceito pela API seja encaminhado ao webhook
publicado do fluxo n8n e que falhas de infraestrutura possam ser diagnosticadas
sem registrar conteúdo da mensagem, contatos ou segredos.

## Regras

- A API envia o evento somente pela rede interna para a URL configurada e com o
  cabeçalho interno já existente.
- Uma resposta HTTP não-2xx do n8n é uma falha de entrega e precisa ser
  registrada apenas com o código HTTP.
- Exceções de rede/timeout continuam sem expor payload ou cabeçalhos.
- O workflow publicado deve conter as referências por `id` e `name` das
  credenciais já existentes no n8n, inclusive no snapshot publicado.
- O node Webhook possui `webhookId` estável para que o n8n registre o caminho
  externo configurado, sem depender de um caminho interno derivado do nome.

## Critérios de aceite

1. O webhook ativo responde diferente de 404 para uma chamada autenticada.
2. A API registra de modo seguro a rejeição HTTP do n8n.
3. Um evento WhatsApp de texto novo cria execução do workflow; as etapas
   seguintes serão avaliadas pela execução, sem vazar dados pessoais.
