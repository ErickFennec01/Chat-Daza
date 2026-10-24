# Spec 12 — Identificadores LID no WAHA

## Objetivo

Aceitar mensagens diretas do WAHA que usam o identificador privado `@lid`, além dos identificadores numéricos `@c.us` e `@s.whatsapp.net`.

## Regras

- Somente chats diretos numéricos são aceitos; grupos, status e broadcasts continuam ignorados.
- O identificador do chat é preservado como contato externo para que a resposta retorne ao mesmo chat.
- `@s.whatsapp.net` é normalizado para `@c.us`; `@lid` é enviado ao WAHA sem conversão.
- Eventos enviados pelo próprio número conectado (`fromMe`) continuam ignorados para evitar loops.

## Aceite

1. Webhook WAHA com origem `123@lid` resolve o canal e é encaminhado ao n8n.
2. A saída para `123@lid` usa `chatId: "123@lid"` no WAHA.
3. Identificadores não diretos continuam sem persistência.
