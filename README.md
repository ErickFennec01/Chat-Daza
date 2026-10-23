# DAZA Atendimento

Plataforma multitenant para agentes de atendimento no WhatsApp.

## Componentes

- `apps/api`: Node.js/TypeScript com NestJS, API privada e adaptador Meta WhatsApp Cloud.
- `apps/web`: painel Next.js para operação do cliente.
- `migrations`: evolução versionada do banco `db_atendimento`.
- `compose.yaml`: stack pronta para importar no Portainer.

## Subida local

1. Copie `.env.example` para `.env` e preencha os valores secretos localmente.
2. Aplique as migrations no banco `db_atendimento` com usuário administrador.
3. Execute `docker compose up --build`.
4. O painel fica em `http://127.0.0.1:3100` e a API em `http://127.0.0.1:8100/docs`.

Não exponha PostgreSQL, Redis, Portainer ou segredos no navegador.
