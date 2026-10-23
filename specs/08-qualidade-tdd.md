# Spec 08 — Qualidade e pirâmide TDD

## Objetivo

Garantir que alterações de interface não contornem regras de negócio, autorização ou isolamento multitenant. O navegador é considerado não confiável: o backend é a fonte de validação e decisão.

## Pirâmide

1. **Unitários:** serviços sem rede/banco real: JWT, Tenant Guard, RBAC, normalização WAHA e criação de canal.
2. **Integração HTTP:** Nest com `ValidationPipe`, guardas e controller, usando dependências simuladas. Confirma `401`, `403`, `400` e o tenant derivado do token.
3. **Smoke E2E:** serviços publicados localmente: login web e `healthz` da API, sem credenciais e sem escrever no banco de produção.

## Critérios de aceite

- Operador não cria/edita agentes, documentos ou canais ainda que altere requisições no navegador.
- `empresa_id` vem de token validado, nunca do JSON enviado pelo frontend.
- Payload inválido ou com campo não permitido retorna `400` antes da regra de negócio.
- WAHA aceita reabertura de sessão salva e nunca recebe token originado no navegador.
- A suíte é executável por `npm run verify` na raiz do repositório.

## Limites atuais

Os testes de integração não tocam no banco real. A próxima camada será uma base PostgreSQL exclusiva de CI, com migrações aplicadas, teste de RLS e rollback por cenário.
