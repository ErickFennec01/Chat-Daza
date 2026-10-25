# Simulações isoladas do n8n

`daza-atendimento-simulacao-isolada.json` é um workflow manual e inativo para
verificar o motor de execução do n8n sem credenciais, rede, Postgres, Redis,
OpenRouter, WAHA ou WhatsApp.

Ele cobre três cenários em uma execução:

| Cenário | Resultado esperado |
|---|---|
| Evento válido | Aceito e resposta simulada, sem entrega externa |
| Mesmo `id_externo` | Marcado como duplicado |
| Evento incompleto | Rejeitado pela validação |

Resultado esperado do resumo: `total: 3`, `aceitos: 1`, `duplicados: 1`,
`rejeitados: 1` e `entrega_externa: false`.

Essa simulação prova o comportamento do runtime e das regras isoladas. A
idempotência entre execuções reais continua sendo garantida pelas funções e
restrições do PostgreSQL do fluxo de produção.
