-- Laboratório isolado: nunca compartilha conversas ou mensagens com produção.
begin;

create table if not exists atendimento.simulacoes_agente (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references atendimento.empresas(id) on delete cascade,
  agente_id uuid not null references atendimento.agentes(id) on delete restrict,
  criado_por_usuario_id uuid references atendimento.usuarios(id) on delete set null,
  titulo text not null default 'Teste de agente' check (length(trim(titulo)) between 2 and 160),
  status text not null default 'ativa' check (status in ('ativa', 'encerrada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists atendimento.simulacoes_mensagens (
  id uuid primary key default gen_random_uuid(),
  simulacao_id uuid not null references atendimento.simulacoes_agente(id) on delete cascade,
  empresa_id uuid not null references atendimento.empresas(id) on delete cascade,
  papel text not null check (papel in ('usuario', 'assistente')),
  conteudo text not null check (length(trim(conteudo)) between 1 and 8000),
  modelo text,
  rag_contexto text,
  created_at timestamptz not null default now()
);

create index if not exists idx_simulacoes_agente__empresa_data on atendimento.simulacoes_agente (empresa_id, updated_at desc);
create index if not exists idx_simulacoes_mensagens__simulacao_data on atendimento.simulacoes_mensagens (simulacao_id, created_at);

alter table atendimento.simulacoes_agente enable row level security;
alter table atendimento.simulacoes_mensagens enable row level security;
drop policy if exists empresa_isolada on atendimento.simulacoes_agente;
create policy empresa_isolada on atendimento.simulacoes_agente using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
drop policy if exists empresa_isolada on atendimento.simulacoes_mensagens;
create policy empresa_isolada on atendimento.simulacoes_mensagens using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'daza_atendimento_app') then
    grant select, insert, update on atendimento.simulacoes_agente, atendimento.simulacoes_mensagens to daza_atendimento_app;
  end if;
end $$;

commit;
