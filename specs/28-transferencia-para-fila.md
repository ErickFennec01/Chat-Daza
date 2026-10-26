# Spec 28 — Transferência para fila humana

## Regras

- A fila de destino é ativa e pertence ao mesmo tenant.
- Operador transfere conversa aberta ou assumida por ele; administrador transfere
  qualquer conversa ativa da empresa.
- A transferência remove o responsável individual, marca a conversa como
  `aguardando_humano` e mantém a IA pausada.
- A auditoria registra usuário, origem, fila e motivo opcional.

## Aceite

1. Não é possível transferir para fila de outro tenant ou inativa.
2. A conversa não é encerrada e não recebe resposta da IA depois da transferência.
3. A auditoria é persistida na mesma transação da atualização.
