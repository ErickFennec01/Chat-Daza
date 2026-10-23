-- Atualiza a auditoria de login por uma fronteira restrita de banco.
begin;

create or replace function atendimento.registrar_login_usuario(
  p_usuario_id uuid,
  p_empresa_id uuid
)
returns void
language sql
security definer
set search_path = atendimento, pg_temp
as $$
  update usuarios
     set ultimo_login_em = now()
   where id = p_usuario_id
     and empresa_id = p_empresa_id
$$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'daza_atendimento_app') then
    grant execute on function atendimento.registrar_login_usuario(uuid, uuid) to daza_atendimento_app;
  end if;
end $$;

commit;
