-- Configuração segura do WhatsApp Cloud e caixa de saída durável.
-- Tokens são cifrados pela API antes de chegar a token_cifrado.
begin;

alter table atendimento.canais_whatsapp
  add column if not exists integracao_id uuid unique references atendimento.integracoes_canais(id) on delete restrict;

create table if not exists atendimento.entregas_mensagens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references atendimento.empresas(id) on delete restrict,
  conversa_id uuid not null references atendimento.conversas(id) on delete cascade,
  mensagem_id uuid not null unique references atendimento.mensagens(id) on delete cascade,
  canal_whatsapp_id uuid references atendimento.canais_whatsapp(id) on delete set null,
  provedor text not null default 'meta_cloud' check (provedor in ('meta_cloud')),
  status text not null default 'pendente' check (status in ('pendente', 'processando', 'enviada', 'falha')),
  tentativas integer not null default 0 check (tentativas >= 0),
  provedor_mensagem_id text,
  erro_codigo text,
  erro_detalhe text,
  enviada_em timestamptz,
  proxima_tentativa_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_entregas_mensagens__empresa_id_status
  on atendimento.entregas_mensagens (empresa_id, status, created_at desc);

drop trigger if exists entregas_mensagens_definir_updated_at on atendimento.entregas_mensagens;
create trigger entregas_mensagens_definir_updated_at before update on atendimento.entregas_mensagens
for each row execute function atendimento.definir_updated_at();

alter table atendimento.integracoes_canais enable row level security;
alter table atendimento.entregas_mensagens enable row level security;

drop policy if exists empresa_isolada on atendimento.integracoes_canais;
create policy empresa_isolada on atendimento.integracoes_canais
  using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);

drop policy if exists empresa_isolada on atendimento.entregas_mensagens;
create policy empresa_isolada on atendimento.entregas_mensagens
  using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'daza_atendimento_app') then
    grant select, insert, update on atendimento.integracoes_canais, atendimento.canais_whatsapp, atendimento.entregas_mensagens to daza_atendimento_app;
  end if;
end $$;

commit;
