# Especificação — Gravação da mensagem de entrada no n8n

## Problema

O nó PostgreSQL chamava `atendimento.registrar_mensagem_entrada`, que retorna
uma tabela, dentro de uma expressão `CASE`. O PostgreSQL rejeita funções que
retornam conjunto nessa posição.

## Regra de implementação

- A gravação ocorre em `CROSS JOIN LATERAL` na ramificação de eventos que o
  resolvedor identificou como não duplicados; a outra ramificação não chama a
  função.
- Eventos duplicados seguem sem uma segunda inserção.
- A consulta mantém os dados necessários para memória, RAG e decisão do
  agente.

## Aceite

1. A consulta é válida para PostgreSQL.
2. Um texto WhatsApp recebido avança do nó 03 para o roteador de sessão.
3. Nenhuma mensagem duplicada é gravada novamente.
