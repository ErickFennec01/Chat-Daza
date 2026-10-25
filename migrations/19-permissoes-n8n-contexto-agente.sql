-- Permissões mínimas do workflow n8n e leitura de agente compatível com RLS.
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
    'system_prompt', a.system_prompt,
    'temperatura', a.temperatura,
    'limite_resposta_tokens', a.limite_resposta_tokens,
    'limiar_confianca', a.limiar_confianca,
    'versao_conhecimento', a.versao_conhecimento
  )
  from agentes a
  where a.id = p_agente_id
    and a.empresa_id = p_empresa_id
    and a.ativo
  limit 1;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'daza_atendimento_app') then
    grant usage on schema atendimento to daza_atendimento_app;
    grant execute on function
      atendimento.resolver_inbound(text, text, text, text, jsonb),
      atendimento.registrar_mensagem_entrada(uuid, uuid, text, text),
      atendimento.obter_memoria_agente(uuid, uuid),
      atendimento.buscar_conhecimento_rag(uuid, text),
      atendimento.obter_contexto_agente(uuid, uuid)
    to daza_atendimento_app;
  end if;
end $$;

commit;
