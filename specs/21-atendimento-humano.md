# Especificação — Atendimento humano pelo canal oficial

## Regras

- Apenas usuário autenticado do painel pode enviar mensagem humana.
- A conversa deve estar assumida pelo próprio usuário e em `aguardando_humano`.
- A mensagem humana é persistida antes da tentativa de entrega WAHA, com modelo
  `humano:<usuario_id>` para auditoria.
- Enquanto assumida, o roteador n8n não envia novas respostas da IA.

## Aceite

1. Outro tenant ou usuário não consegue enviar pela conversa.
2. A mensagem é gravada, enfileirada e enviada pelo mesmo mecanismo WAHA.
3. Uma falha de WAHA preserva a entrega como falha auditável.
