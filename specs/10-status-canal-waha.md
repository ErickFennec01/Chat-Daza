# Spec 10 — Estado operacional do canal WAHA

## Objetivo

Exibir no painel, por canal, o estado atual consultado diretamente no WAHA: conectado, aguardando QR, conectando, desconectado ou indisponível.

## Regras

- A API encontra a sessão pelo canal pertencente ao tenant autenticado.
- Somente administradores consultam estado de canal.
- A resposta não contém QR, chave WAHA ou identificador da conta vinculada.
- A consulta é transitória: nenhum novo dado operacional é gravado no banco.

## Aceite

1. Um canal em `WORKING` aparece como **Conectado**.
2. Um canal em `SCAN_QR_CODE` aparece como **Aguardando QR**.
3. O botão “Atualizar status” consulta apenas o canal da empresa autenticada.
