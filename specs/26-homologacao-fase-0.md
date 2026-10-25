# Spec 26 — Homologação da Fase 0

## Objetivo

Confirmar o percurso completo de atendimento sem usar dados de produção como
teste e sem disparar mensagens reais automaticamente.

## Regras de negócio verificadas

1. Um evento de entrada válido é normalizado e encaminhado para a resolução
   durável no PostgreSQL.
2. O mesmo `id_externo` não deve produzir uma segunda mensagem, decisão ou
   entrega.
3. Quando a conversa está `aguardando_humano`, o workflow não chama o modelo.
4. Após encerrar uma conversa, uma nova mensagem cria outro `conversa_id` e o
   prompt não recebe histórico anterior.
5. Ao escalar, a dúvida registrada contém a última pergunta do cliente; o
   erro técnico permanece interno.

## Automação segura

O script `scripts/homologar-fase-0.ps1` executa somente validações locais:

- lint, build e testes da API;
- validação das fixtures do workflow;
- health check autenticado apenas pela rede local da API.

Ele não chama n8n, OpenRouter, WAHA nem WhatsApp.

## Roteiro manual controlado

Executar em um canal de teste, com um contato autorizado:

1. Confirmar que a sessão WAHA está conectada na tela de Canais.
2. Enviar uma pergunta coberta pela base e confirmar uma única resposta da IA.
3. Reenviar o mesmo evento pelo mecanismo de teste do provedor, quando
   disponível, e confirmar que não há segunda resposta.
4. Enviar uma pergunta fora da base e confirmar: fila humana, dúvida legível e
   nenhuma resposta adicional da IA.
5. Assumir a conversa na plataforma, enviar uma mensagem humana e confirmar a
   entrega ao contato de teste.
6. Encerrar o atendimento e enviar uma nova mensagem pelo mesmo contato.
   Confirmar novo atendimento e ausência de contexto anterior.
7. Desconectar a sessão em homologação e confirmar que a entrega falha com
   estado observável, sem apagar a mensagem ou a conversa.

## Critérios de aceite

- `npm run lint`, `npm run build` e a suíte de testes passam.
- As fixtures válida e inválida passam; a duplicidade permanece documentada
  como verificação durável do PostgreSQL entre execuções.
- A API responde `status: ok` localmente.
- Os sete passos manuais possuem evidência registrada antes de ativar um novo
  canal de cliente.

## Limites

Esta fase não homologa desempenho, carga, recuperação de desastre ou entrega
exata do WhatsApp. Esses itens pertencem às fases de resiliência e produção.
