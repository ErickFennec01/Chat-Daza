# Evolução operacional da Central de Atendimento

## Entregas planejadas

1. **Fundação operacional:** política de reabertura, filas com SLA, prioridade, auditoria e métricas persistidas.
2. **Roteiros:** CRUD de etapas, vínculo com agente e contexto para o n8n.
3. **Inbox humano:** atribuição, transferência, encerramento, filtros e atualização periódica da fila.
4. **Conhecimento:** revisão de dúvidas, fontes exibidas na decisão e gestão de versões do RAG.
5. **Resiliência:** reprocessamento de entregas falhas e visão operacional do canal.

## Regras transversais

- Todo dado é isolado por `empresa_id`; a empresa vem da sessão ou da integração autenticada.
- A conversa é a fonte do histórico. Não se apaga mensagem, entrega ou auditoria.
- A IA responde enquanto a conversa estiver `aberta`. Uma conversa assumida ou transferida fica `aguardando_humano`.
- Após `encerrada` ou `resolvida`, a política padrão inicia outra conversa para a próxima mensagem do cliente. A reabertura do mesmo histórico é opt-in, por uma janela configurada pela empresa.
- Uma conversa em `aguardando_humano` permanece exclusivamente na fila humana até ser encerrada; a IA não recebe o seu histórico nem gera resposta.
- Ação humana sensível deve registrar auditoria com usuário, tipo e detalhes mínimos.

## Fora deste incremento

Não haverá alegação de atualização em tempo real por WebSocket, importação de PDFs ou reprocessamento automático até que cada integração tenha implementação e teste próprios. O painel usará atualização explícita/curto polling enquanto isso.
