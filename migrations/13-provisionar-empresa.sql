-- Provisionamento administrativo de tenants sem conceder acesso direto
-- à tabela de empresas ao papel de execução da aplicação.
begin;

create or replace function atendimento.criar_empresa(
  p_empresa_erp_id uuid,
  p_razao_social text,
  p_slug text
)
returns table(id uuid, razao_social text, slug text)
language plpgsql
security definer
set search_path = atendimento, pg_temp
as $$
begin
  return query
  insert into empresas (empresa_erp_id, razao_social, slug)
  values (p_empresa_erp_id, trim(p_razao_social), trim(p_slug))
  returning empresas.id, empresas.razao_social, empresas.slug;
end;
$$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'daza_atendimento_app') then
    grant execute on function atendimento.criar_empresa(uuid, text, text) to daza_atendimento_app;
  end if;
end $$;

commit;
