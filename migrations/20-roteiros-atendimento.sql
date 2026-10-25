-- Fundação multitenant para roteiros e transferência de atendimento.
begin;

create table if not exists atendimento.roteiros_atendimento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references atendimento.empresas(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 120),
  descricao text not null default '' check (length(descricao) <= 2000),
  etapas jsonb not null default '[]'::jsonb check (jsonb_typeof(etapas) = 'array'),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, nome)
);

alter table atendimento.agentes
  add column if not exists roteiro_id uuid references atendimento.roteiros_atendimento(id) on delete set null;

create index if not exists idx_roteiros_atendimento__empresa_ativo
  on atendimento.roteiros_atendimento (empresa_id, ativo, updated_at desc);
create index if not exists idx_agentes__roteiro_id
  on atendimento.agentes (roteiro_id) where roteiro_id is not null;

create table if not exists atendimento.conversas_roteiros (
  conversa_id uuid primary key references atendimento.conversas(id) on delete cascade,
  empresa_id uuid not null references atendimento.empresas(id) on delete cascade,
  roteiro_id uuid not null references atendimento.roteiros_atendimento(id) on delete restrict,
  etapa_atual_id text not null check (length(trim(etapa_atual_id)) between 1 and 80),
  transferida_at timestamptz,
  motivo_transferencia text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversas_roteiros__empresa_roteiro
  on atendimento.conversas_roteiros (empresa_id, roteiro_id, updated_at desc);

drop trigger if exists roteiros_atendimento_definir_updated_at on atendimento.roteiros_atendimento;
create trigger roteiros_atendimento_definir_updated_at before update on atendimento.roteiros_atendimento
for each row execute function atendimento.definir_updated_at();

alter table atendimento.roteiros_atendimento enable row level security;
alter table atendimento.conversas_roteiros enable row level security;

drop policy if exists empresa_isolada on atendimento.roteiros_atendimento;
create policy empresa_isolada on atendimento.roteiros_atendimento
using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid)
with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);

drop policy if exists empresa_isolada on atendimento.conversas_roteiros;
create policy empresa_isolada on atendimento.conversas_roteiros
using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid)
with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);

create or replace function atendimento.obter_roteiro_agente(p_empresa_id uuid, p_agente_id uuid)
returns jsonb language sql security definer stable set search_path = atendimento, pg_temp as $$
  select jsonb_build_object('id', r.id, 'nome', r.nome, 'descricao', r.descricao, 'etapas', r.etapas)
  from agentes a
  join roteiros_atendimento r on r.id = a.roteiro_id and r.empresa_id = a.empresa_id and r.ativo
  where a.id = p_agente_id and a.empresa_id = p_empresa_id and a.ativo
  limit 1;
$$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'daza_atendimento_app') then
    grant select, insert, update on atendimento.roteiros_atendimento, atendimento.conversas_roteiros to daza_atendimento_app;
    grant execute on function atendimento.obter_roteiro_agente(uuid, uuid) to daza_atendimento_app;
  end if;
end $$;

commit;
