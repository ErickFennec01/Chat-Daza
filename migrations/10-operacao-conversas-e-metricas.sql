-- Operação humana e observabilidade do atendimento.
-- Execute como administrador de db_atendimento.
begin;

alter table atendimento.conversas
  add column if not exists atendida_por_usuario_id uuid references atendimento.usuarios(id) on delete set null,
  add column if not exists assumida_em timestamptz;

create index if not exists idx_conversas__empresa_id_responsavel_status
  on atendimento.conversas (empresa_id, atendida_por_usuario_id, status, updated_at desc);

-- Todas as tabelas com empresa_id recebem a mesma fronteira de tenant.
alter table atendimento.execucoes_agente enable row level security;
alter table atendimento.acoes_agente enable row level security;
alter table atendimento.eventos_entrada enable row level security;

drop policy if exists empresa_isolada on atendimento.execucoes_agente;
create policy empresa_isolada on atendimento.execucoes_agente
  using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);

drop policy if exists empresa_isolada on atendimento.acoes_agente;
create policy empresa_isolada on atendimento.acoes_agente
  using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);

drop policy if exists empresa_isolada on atendimento.eventos_entrada;
create policy empresa_isolada on atendimento.eventos_entrada
  using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'daza_atendimento_app') then
    grant select on atendimento.execucoes_agente, atendimento.acoes_agente, atendimento.eventos_entrada to daza_atendimento_app;
  end if;
end $$;

commit;
