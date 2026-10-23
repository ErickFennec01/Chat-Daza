# Spec 00 — visão do produto

## Problema

Empresas querem atender clientes pelo WhatsApp com IA, mas precisam controlar o comportamento do agente, a base de conhecimento, o que ficou sem resposta e quando uma pessoa deve assumir.

## MVP

Uma central DAZA multitenant em que cada empresa pode:

1. cadastrar seu canal de WhatsApp;
2. configurar um agente (system prompt, modelo e limites);
3. cadastrar conhecimento textual/documental;
4. acompanhar conversas e perguntas sem resposta;
5. revisar uma dúvida, registrar a resposta curada e alimentar o conhecimento;
6. atender conversas escaladas por humano.

## Fora do MVP

- cobrança por uso e assinatura;
- múltiplos atendentes com permissões refinadas;
- campanhas e envio em massa;
- integrações CRM além do WhatsApp;
- treinamento/fine-tuning de modelos;
- marketplace de agentes.

## Princípios

- um único produto, várias empresas, isolamento obrigatório por `empresa_id`;
- PostgreSQL é a fonte de verdade; Redis é apenas cache;
- nenhum token de WhatsApp, banco ou modelo no navegador ou no n8n;
- toda decisão do agente é auditável;
- quando a IA não sabe, ela escala e abre uma pendência; não inventa.
