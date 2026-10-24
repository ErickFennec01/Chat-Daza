# Spec 14 — Observabilidade segura do webhook WAHA

## Objetivo

Eliminar descartes silenciosos de eventos WAHA e aceitar a representação textual `"false"` do campo `fromMe`, sem registrar conteúdo, números ou identificadores completos de contatos.

## Regras

- O log operacional registra somente o motivo de descarte e o sufixo do tipo de chat (`@c.us`, `@lid`, grupo ou ausente).
- Mensagens próprias continuam ignoradas quando `fromMe` é booleano `true` ou texto `"true"`.
- Mensagens de chat direto com `fromMe: false` ou `"false"` seguem para o n8n.

## Aceite

1. Evento descartado emite motivo seguro no log da API.
2. Evento com `fromMe: "false"` resolve o canal e é encaminhado.
3. Nenhum log novo contém corpo de mensagem, telefone ou chave.
