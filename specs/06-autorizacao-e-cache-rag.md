# Spec 06 — autorização e invalidação do RAG

## Regras de negócio

- Usuários `admin` podem configurar agentes, conhecimento, canais e tratar dúvidas escaladas.
- Usuários `operador` podem visualizar conversas e métricas e assumir atendimentos, mas não podem alterar a configuração que direciona a IA.
- Cada inclusão, edição, ativação, desativação ou remoção de documento incrementa a versão de conhecimento de todos os agentes da mesma empresa.
- A chave RAG no Redis inclui a versão do agente. Assim, uma alteração não reutiliza conteúdo de uma versão anterior; as chaves antigas expiram pelo TTL atual de quinze minutos.

## Critérios de aceite

1. Uma sessão de operador recebe `403` ao tentar gravar agente, documento, canal ou resolver dúvida.
2. A mesma sessão continua podendo listar e assumir conversas da própria empresa.
3. Uma alteração de documento da empresa A incrementa apenas as versões dos agentes da empresa A.
4. O workflow monta uma chave Redis diferente após a alteração de conhecimento.
