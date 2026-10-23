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

## Primeiro acesso ao painel

Após criar a empresa pela rota administrativa, crie o primeiro usuário com a
chave administrativa que está somente no ambiente da API:

```powershell
$headers = @{ 'x-daza-admin-key' = $env:DAZA_ADMIN_KEY; 'Content-Type' = 'application/json' }
$body = @{ nome = 'Administrador'; email = 'admin@empresa.com'; senha = 'uma-senha-longa-com-12-ou-mais-caracteres'; papel = 'admin' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8100/v1/admin/empresas/SEU_EMPRESA_ID/usuarios' -Headers $headers -Body $body
```

O painel autentica esse usuário em `/login`. A API devolve o token apenas ao
BFF do Next.js, que o mantém em cookie `HttpOnly`; o browser não recebe chave
de banco, chave de tenant nem segredo de sessão.

Em uma URL HTTPS publicada, defina `SESSION_COOKIE_SECURE=true`. O valor
`false` do exemplo existe somente para o acesso local por `http://127.0.0.1`.

## Canal WhatsApp Cloud

Na aba **Canais**, informe o `Phone Number ID` e um access token da Meta. A API
cifra o token com `CHANNEL_SECRETS_KEY` (uma chave Base64 de 32 bytes) antes de
persisti-lo. O token não é devolvido pela API nem pelo painel. Uma decisão do
agente cria primeiro uma entrega durável no banco; só então a API faz a chamada
para a Meta e registra se a mensagem foi enviada ou falhou.
