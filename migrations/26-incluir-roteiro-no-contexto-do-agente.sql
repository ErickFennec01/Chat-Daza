-- O workflow já consome obter_contexto_agente. Incorporar o roteiro no campo
-- system_prompt mantém a compatibilidade do JSON n8n publicado e aplica o
-- roteiro ao próximo evento sem expor leitura direta de tabelas ao n8n.
begin;

create or replace function atendimento.obter_contexto_agente(
  p_empresa_id uuid,
  p_agente_id uuid
)
returns jsonb
language sql
security definer
stable
set search_path = atendimento, pg_temp
as $$
  select jsonb_build_object(
    'modelo', a.modelo,
    'system_prompt', a.system_prompt || case when r.id is null then '' else
      E'\n\nROTEIRO ATIVO — siga as etapas na ordem. Não avance sem cumprir o objetivo. Se o cliente pedir humano ou se uma etapa exigir transferência, escolha escalar.\nNome: '
      || r.nome || E'\nDescrição: ' || r.descricao || E'\nEtapas: ' || r.etapas::text end,
    'temperatura', a.temperatura,
    'limite_resposta_tokens', a.limite_resposta_tokens,
    'limiar_confianca', a.limiar_confianca,
    'versao_conhecimento', a.versao_conhecimento,
    'roteiro_id', r.id
  )
  from agentes a
  left join roteiros_atendimento r
    on r.id = a.roteiro_id and r.empresa_id = a.empresa_id and r.ativo
  where a.id = p_agente_id
    and a.empresa_id = p_empresa_id
    and a.ativo
  limit 1;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'daza_atendimento_app') then
    grant execute on function atendimento.obter_contexto_agente(uuid, uuid) to daza_atendimento_app;
  end if;
end $$;

commit;
