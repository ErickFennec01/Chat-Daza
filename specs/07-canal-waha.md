# Spec 07 — Canal WhatsApp por WAHA Core

## Decisão

O MVP usa WAHA Core autocontrolado como gateway WhatsApp. Cada canal da plataforma aponta para uma sessão WAHA única; o cliente pareia o número por QR Code. Não há token Meta Cloud no painel, no banco ou no n8n.

## Fluxo

1. Administrador escolhe o agente e cria um canal com um nome de sessão WAHA.
2. O painel pede à API que crie/inicie a sessão e recebe somente a imagem QR temporária.
3. Após o pareamento, WAHA envia eventos `message` para a API privada com cabeçalho secreto.
4. A API resolve a sessão para o tenant/canal, despacha o contrato normalizado ao n8n e mantém deduplicação e RAG atuais.
5. A resposta aprovada percorre a caixa de saída e a API chama `POST /api/sendText` do WAHA com sua chave privada de infraestrutura.

## Segurança e limites

- WAHA não tem porta pública; apenas a API tem acesso pela rede Docker.
- A chave WAHA e o segredo do webhook existem exclusivamente no `.env` local.
- O QR não é persistido no banco; é devolvido apenas a uma sessão autenticada de administrador.
- WAHA é integração não oficial do WhatsApp Web. Cada tenant deve usar um número dedicado, autorizado e sem disparos em massa. Há risco de bloqueio; não é adequado para comunicações críticas ou spam.

## Aceite

1. Criar um canal não solicita token Meta.
2. Apenas administradores obtêm QR ou alteram o canal.
3. Evento WAHA sem cabeçalho secreto não é persistido.
4. A sessão WAHA mapeia para um único tenant e a saída usa a mesma sessão.
