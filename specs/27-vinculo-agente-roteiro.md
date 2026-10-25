# Spec 27 — Vínculo de agente a roteiro

## Objetivo

Permitir que administradores definam, pela tela de Roteiros, qual roteiro ativo orienta cada agente da própria empresa.

## Regras

- Apenas administradores autenticados podem alterar o vínculo.
- O agente e o roteiro devem pertencer à mesma empresa.
- O roteiro precisa estar ativo para ser associado.
- Desvincular um roteiro é permitido e não altera conversas já existentes.
- A API retorna somente dados escopados ao tenant autenticado.
- O contexto entregue ao workflow recebe o roteiro ativo junto ao `system_prompt`.

## Aceite

1. Um administrador associa e troca um roteiro de agente pelo painel.
2. Uma tentativa de usar roteiro de outro tenant é rejeitada.
3. O painel mostra qual agente está associado a cada roteiro.
4. O agente sem roteiro continua funcionando com seu prompt padrão.
5. O contexto do agente associado contém as etapas sem exigir mudança de credencial no n8n.
