-- Fundação operacional multitenant: políticas, filas, prioridade e auditoria.
begin;

create table if not exists atendimento.politicas_atendimento (
  empresa_id uuid primary key references atendimento.empresas(id) on delete cascade,
  janela_reabertura_minutos integer not null default 1440 check (janela_reabertura_minutos between 0 and 43200),
  sla_primeira_resposta_minutos integer not null default 15 check (sla_primeira_resposta_minutos between 1 and 10080),
  atualizado_em timestamptz not null default now()
);

create table if not exists atendimento.filas_atendimento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references atendimento.empresas(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 120),
  descricao text not null default '' check (length(descricao) <= 1000),
  prioridade_padrao smallint not null default 3 check (prioridade_padrao between 1 and 5),
  sla_primeira_resposta_minutos integer check (sla_primeira_resposta_minutos between 1 and 10080),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, nome)
);

alter table atendimento.conversas
  add column if not exists fila_atendimento_id uuid references atendimento.filas_atendimento(id) on delete set null,
  add column if not exists prioridade smallint not null default 3 check (prioridade between 1 and 5),
  add column if not exists primeira_resposta_em timestamptz,
  add column if not exists reaberta_em timestamptz,
  add column if not exists transferida_em timestamptz,
  add column if not exists motivo_transferencia text;

create index if not exists idx_conversas__fila_prioridade_aberta
  on atendimento.conversas (empresa_id, fila_atendimento_id, prioridade, created_at)
  where status in ('aberta', 'aguardando_humano');

create table if not exists atendimento.auditoria_atendimento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references atendimento.empresas(id) on delete cascade,
  conversa_id uuid references atendimento.conversas(id) on delete set null,
  usuario_id uuid references atendimento.usuarios(id) on delete set null,
  origem text not null check (origem in ('usuario', 'ia', 'sistema', 'integracao')),
  acao text not null check (length(trim(acao)) between 2 and 120),
  detalhes jsonb not null default '{}'::jsonb check (jsonb_typeof(detalhes) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists idx_auditoria_atendimento__empresa_conversa_data
  on atendimento.auditoria_atendimento (empresa_id, conversa_id, created_at desc);

drop trigger if exists filas_atendimento_definir_updated_at on atendimento.filas_atendimento;
create trigger filas_atendimento_definir_updated_at before update on atendimento.filas_atendimento
for each row execute function atendimento.definir_updated_at();

alter table atendimento.politicas_atendimento enable row level security;
alter table atendimento.filas_atendimento enable row level security;
alter table atendimento.auditoria_atendimento enable row level security;

drop policy if exists empresa_isolada on atendimento.politicas_atendimento;
create policy empresa_isolada on atendimento.politicas_atendimento
using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid)
with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
drop policy if exists empresa_isolada on atendimento.filas_atendimento;
create policy empresa_isolada on atendimento.filas_atendimento
using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid)
with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
drop policy if exists empresa_isolada on atendimento.auditoria_atendimento;
create policy empresa_isolada on atendimento.auditoria_atendimento
using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid)
with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);

create or replace function atendimento.registrar_auditoria_atendimento(
  p_empresa_id uuid, p_conversa_id uuid, p_usuario_id uuid, p_origem text, p_acao text, p_detalhes jsonb default '{}'::jsonb
)
returns void language sql security definer set search_path = atendimento, pg_temp as $$
  insert into auditoria_atendimento (empresa_id, conversa_id, usuario_id, origem, acao, detalhes)
  values (p_empresa_id, p_conversa_id, p_usuario_id, p_origem, p_acao, coalesce(p_detalhes, '{}'::jsonb));
$$;

-- Eventos novos do cliente podem reabrir uma conversa recém-finalizada. A busca por
-- atendimento ativo vem antes para preservar a garantia de uma única conversa ativa.
create or replace function atendimento.resolver_inbound(
  p_canal text, p_destino text, p_remetente text, p_id_externo text, p_metadados jsonb default '{}'::jsonb
)
returns table(empresa_id uuid, conversa_id uuid, status text, duplicado boolean)
language plpgsql security definer set search_path = atendimento, pg_temp as $$
declare
  v_integracao uuid;
  v_empresa uuid;
  v_conversa uuid;
  v_status text;
  v_janela integer;
begin
  select i.id, i.empresa_id into v_integracao, v_empresa
    from integracoes_canais i join empresas e on e.id=i.empresa_id
   where i.canal=p_canal and i.identificador_destino=p_destino and i.ativo and e.ativo;
  if not found then raise exception 'Integração ativa não encontrada para canal/destino'; end if;

  if exists (select 1 from eventos_entrada where integracao_id=v_integracao and id_externo=p_id_externo) then
    select e.conversa_id, c.status into v_conversa, v_status
      from eventos_entrada e left join conversas c on c.id=e.conversa_id
     where e.integracao_id=v_integracao and e.id_externo=p_id_externo;
    return query select v_empresa, v_conversa, v_status, true;
    return;
  end if;

  select c.id, c.status into v_conversa, v_status from conversas c
   where c.empresa_id=v_empresa and c.canal=p_canal and c.contato_externo=p_remetente
     and c.status in ('aberta', 'aguardando_humano')
   order by c.updated_at desc limit 1;
  if found then
    insert into eventos_entrada(integracao_id,empresa_id,id_externo,conversa_id) values(v_integracao,v_empresa,p_id_externo,v_conversa);
    return query select v_empresa, v_conversa, v_status, false;
    return;
  end if;

  select coalesce(p.janela_reabertura_minutos, 1440) into v_janela
    from empresas e left join politicas_atendimento p on p.empresa_id=e.id where e.id=v_empresa;
  select c.id into v_conversa from conversas c
   where c.empresa_id=v_empresa and c.canal=p_canal and c.contato_externo=p_remetente
     and c.status in ('resolvida', 'encerrada') and c.encerrada_at >= now() - make_interval(mins => v_janela)
   order by c.encerrada_at desc limit 1;
  if found and v_janela > 0 then
    update conversas c set status='aberta', atendida_por_usuario_id=null, assumida_em=null, reaberta_em=now(), updated_at=now()
     where c.id=v_conversa and c.empresa_id=v_empresa;
    perform registrar_auditoria_atendimento(v_empresa, v_conversa, null, 'integracao', 'conversa_reaberta', jsonb_build_object('janela_minutos', v_janela));
    insert into eventos_entrada(integracao_id,empresa_id,id_externo,conversa_id) values(v_integracao,v_empresa,p_id_externo,v_conversa);
    return query select v_empresa, v_conversa, 'aberta'::text, false;
    return;
  end if;

  select c.conversa_id, c.status into v_conversa, v_status
    from criar_conversa(v_empresa,p_canal,p_remetente,null,p_metadados) c;
  insert into eventos_entrada(integracao_id,empresa_id,id_externo,conversa_id) values(v_integracao,v_empresa,p_id_externo,v_conversa);
  return query select v_empresa,v_conversa,v_status,false;
end;
$$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'daza_atendimento_app') then
    grant select, insert, update on atendimento.politicas_atendimento, atendimento.filas_atendimento, atendimento.auditoria_atendimento to daza_atendimento_app;
    grant execute on function atendimento.registrar_auditoria_atendimento(uuid, uuid, uuid, text, text, jsonb), atendimento.resolver_inbound(text, text, text, text, jsonb) to daza_atendimento_app;
  end if;
end $$;

commit;
