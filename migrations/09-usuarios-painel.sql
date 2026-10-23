-- Usuários humanos do painel DAZA Atendimento.
-- Execute como administrador de db_atendimento. Não contém senhas em texto puro.
begin;

create table if not exists atendimento.usuarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references atendimento.empresas(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 160),
  email text not null check (email = lower(trim(email)) and length(email) between 5 and 320),
  senha_hash text not null check (length(senha_hash) >= 50),
  papel text not null default 'operador' check (papel in ('admin', 'operador')),
  ativo boolean not null default true,
  ultimo_login_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No MVP, um e-mail identifica uma pessoa em toda a plataforma. Isso torna o
-- login inequívoco e pode evoluir para associação N:N caso seja necessário.
create unique index if not exists uq_usuarios__email on atendimento.usuarios (email);
create index if not exists idx_usuarios__empresa_id_ativo on atendimento.usuarios (empresa_id, ativo);

drop trigger if exists usuarios_definir_updated_at on atendimento.usuarios;
create trigger usuarios_definir_updated_at before update on atendimento.usuarios
for each row execute function atendimento.definir_updated_at();

alter table atendimento.usuarios enable row level security;
drop policy if exists empresa_isolada on atendimento.usuarios;
create policy empresa_isolada on atendimento.usuarios
  using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);

-- A fronteira de autenticação roda antes de a empresa ser conhecida. A função
-- expõe somente o registro ativo correspondente ao e-mail informado.
create or replace function atendimento.autenticar_usuario(p_email text)
returns table(id uuid, empresa_id uuid, nome text, email text, senha_hash text, papel text)
language sql security definer stable set search_path = atendimento, pg_temp as $$
  select u.id, u.empresa_id, u.nome, u.email, u.senha_hash, u.papel
  from usuarios u
  where u.email = lower(trim(p_email)) and u.ativo
  limit 1;
$$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'daza_atendimento_app') then
    grant insert, update on atendimento.usuarios to daza_atendimento_app;
    revoke select on atendimento.usuarios from daza_atendimento_app;
    grant execute on function atendimento.autenticar_usuario(text) to daza_atendimento_app;
  end if;
end $$;

commit;
