# Spec 05 — critérios de aceite e testes

## Testes de dados e API

1. Criar empresa A e B; token da A não lista nem altera recursos da B.
2. Mensagem Meta válida cria uma conversa e uma mensagem para o canal correto.
3. Reenvio do mesmo `id_externo` não cria segunda mensagem nem segunda resposta.
4. Assinatura Meta inválida recebe `401` e não persiste evento.
5. Decisão `escalar` cria pergunta sem resposta e muda a conversa para fila humana.
6. Documento alterado incrementa versão do conhecimento e invalida cache correspondente.
7. Usuário válido recebe uma sessão de oito horas; senha ou sessão inválida recebe `401`.
8. Cookie de sessão é `HttpOnly` e nenhuma chave de banco, tenant ou sessão aparece no bundle do navegador.

## Testes do n8n

- evento válido: retorna decisão estruturada;
- evento sem campos obrigatórios: falha antes de acessar IA;
- evento duplicado: não chama OpenRouter;
- escalar: não envia resposta automática ao cliente.

## Definition of done do MVP

- migration aplicada e reversibilidade documentada;
- API e painel sobem pela stack do Portainer;
- testes de isolamento e idempotência passam;
- Meta e OpenRouter homologados em número de teste;
- observabilidade de erros e backup do banco verificados.
