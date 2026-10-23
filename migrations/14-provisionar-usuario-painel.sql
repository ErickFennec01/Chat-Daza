-- Provisionamento de usuários do painel sem conceder SELECT sobre hashes de senha.
begin;

create or replace function atendimento.criar_usuario_painel(
  p_empresa_id uuid,
  p_nome text,
  p_email text,
  p_senha_hash text,
  p_papel text
)
returns table(
  id uuid,
  empresa_id uuid,
  nome text,
  email text,
  papel text,
  ativo boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = atendimento, pg_temp
as $$
begin
  return query
  insert into usuarios (empresa_id, nome, email, senha_hash, papel)
  values (p_empresa_id, trim(p_nome), lower(trim(p_email)), p_senha_hash, p_papel)
  returning usuarios.id, usuarios.empresa_id, usuarios.nome, usuarios.email,
            usuarios.papel, usuarios.ativo, usuarios.created_at;
end;
$$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'daza_atendimento_app') then
    grant execute on function atendimento.criar_usuario_painel(uuid, text, text, text, text) to daza_atendimento_app;
  end if;
end $$;

commit;
