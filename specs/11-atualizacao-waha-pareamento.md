# Spec 11 — Atualização e novo pareamento WAHA

## Objetivo

Atualizar o conector WAHA para a versão `2026.9.2`, que contém correções recentes de compatibilidade WEBJS, e recriar somente a sessão WAHA que falhou para obter um novo QR Code.

## Regras

- A imagem permanece fixada em versão explícita; não usar `latest` sem revisão.
- Banco PostgreSQL, Redis, API, painel e o registro do canal no banco não são alterados.
- A remoção se limita ao estado de pareamento da sessão `dazaerp-suporte`, que já está em `FAILED`.
- O QR e a chave da API não são registrados em logs, commit ou interface fora do fluxo autenticado.

## Aceite

1. O contêiner WAHA executa a imagem `devlikeapro/waha:latest-2026.9.2`.
2. A sessão recriada muda para `SCAN_QR_CODE` e fornece QR pelo endpoint interno.
3. Após escanear, o estado esperado é `WORKING` e o painel o traduz para **Conectado**.
