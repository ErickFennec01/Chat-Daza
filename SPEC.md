# DAZA Atendimento — especificação inicial

## Objetivo

Centralizar atendimento WhatsApp multiempresa. Cada empresa administra seu agente, instruções, conhecimento, perguntas sem resposta e atendimentos escalados, sem acesso aos dados de outra empresa.

## Decisões de arquitetura

- Banco de dados: `db_atendimento`; PostgreSQL é a fonte de verdade.
- Backend: Node.js/TypeScript com NestJS, responsável por autenticação, regras de negócio, credenciais de canal e isolamento de tenant.
- Painel: Next.js/TypeScript, acessando somente o backend.
- Redis: cache de RAG e fila/limitação; nunca fonte de verdade.
- n8n: recebe eventos já normalizados pelo backend e devolve somente uma decisão/resposta. Não armazena tokens de WhatsApp por empresa.
- WhatsApp: adaptador inicial para Meta Cloud API. O contrato permite incluir outro provedor sem alterar a camada de agente.

## Regras de negócio

1. Todo registro de negócio possui `empresa_id` e toda leitura/escrita deriva a empresa da credencial autenticada.
2. Uma empresa pode ter vários agentes e canais; um canal ativo aponta para um agente padrão.
3. Um agente possui system prompt, modelo, limites, política de escalonamento e versão de conhecimento.
4. Perguntas sem resposta são criadas quando o agente pede escalonamento ou quando a resposta não tem contexto suficiente.
5. Credenciais de WhatsApp ficam cifradas no backend; o frontend e o n8n nunca as recebem.
6. Eventos de WhatsApp são idempotentes pelo identificador externo do provedor.

## Critérios de aceite da primeira entrega

- Criar empresa, agente e canal via API administrativa protegida.
- Atualizar system prompt e listar documentos/perguntas pendentes somente da empresa autenticada.
- Receber webhook Meta, identificar o canal e encaminhar evento normalizado ao n8n.
- Receber a decisão do n8n, persistir resposta, escalonamento e pergunta sem resposta.
- Garantir teste de isolamento: token de uma empresa não lê nem altera dados da outra.
- Manter webhooks inativos no n8n até credenciais e teste de homologação.
