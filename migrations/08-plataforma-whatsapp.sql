-- db_atendimento: plataforma DAZA de atendimento WhatsApp
-- Execute como administrador do banco. Não contém senhas nem tokens.
begin;

create table if not exists atendimento.agentes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references atendimento.empresas(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 120),
  ativo boolean not null default true,
  system_prompt text not null default '',
  modelo text not null default 'openrouter/free' check (length(trim(modelo)) between 3 and 160),
  temperatura numeric(3,2) not null default 0.20 check (temperatura between 0 and 2),
  limite_resposta_tokens integer not null default 450 check (limite_resposta_tokens between 64 and 2000),
  limiar_confianca numeric(3,2) not null default 0.60 check (limiar_confianca between 0 and 1),
  versao_conhecimento integer not null default 1 check (versao_conhecimento > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, nome)
);

create table if not exists atendimento.canais_whatsapp (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references atendimento.empresas(id) on delete cascade,
  agente_id uuid not null references atendimento.agentes(id) on delete restrict,
  provedor text not null default 'meta_cloud' check (provedor in ('meta_cloud', 'evolution', 'outro')),
  phone_number_id text not null unique check (length(trim(phone_number_id)) between 4 and 160),
  display_name text,
  token_cifrado bytea,
  ativo boolean not null default true,
  configuracao jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((configuracao - 'token') = configuracao)
);

create table if not exists atendimento.perguntas_sem_resposta (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references atendimento.empresas(id) on delete cascade,
  conversa_id uuid references atendimento.conversas(id) on delete set null,
  mensagem_id uuid references atendimento.mensagens(id) on delete set null,
  pergunta text not null check (length(trim(pergunta)) between 1 and 8000),
  motivo text not null check (motivo in ('sem_contexto', 'baixa_confianca', 'escalonamento', 'erro_modelo')),
  status text not null default 'aberta' check (status in ('aberta', 'em_revisao', 'respondida', 'descartada')),
  resposta_curada text,
  resolvida_at timestamptz,
  resolvida_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists atendimento.api_chaves (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references atendimento.empresas(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 120),
  prefixo text not null unique check (length(prefixo) between 8 and 24),
  segredo_hash text not null unique,
  escopos text[] not null default array['painel']::text[],
  ativo boolean not null default true,
  expira_em timestamptz,
  ultimo_uso_em timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (empresa_id, nome)
);

create index if not exists idx_agentes__empresa_id_ativo on atendimento.agentes (empresa_id, ativo);
create index if not exists idx_canais_whatsapp__empresa_id_ativo on atendimento.canais_whatsapp (empresa_id, ativo);
create index if not exists idx_perguntas_sem_resposta__empresa_status on atendimento.perguntas_sem_resposta (empresa_id, status, created_at desc);
create index if not exists idx_api_chaves__prefixo_ativo on atendimento.api_chaves (prefixo, ativo);

-- Funções de fronteira: permitem autenticar/rotear antes de existir um tenant na transação.
create or replace function atendimento.autenticar_api_chave(p_prefixo text, p_hash text)
returns uuid language sql security definer stable set search_path = atendimento, pg_temp as $$
  select empresa_id from api_chaves
  where prefixo = p_prefixo and segredo_hash = p_hash and ativo
    and revoked_at is null and (expira_em is null or expira_em > now())
  limit 1;
$$;

create or replace function atendimento.resolver_canal_whatsapp(p_phone_number_id text)
returns table(empresa_id uuid, canal_id uuid, agente_id uuid, provedor text)
language sql security definer stable set search_path = atendimento, pg_temp as $$
  select empresa_id, id, agente_id, provedor from canais_whatsapp
  where phone_number_id = p_phone_number_id and ativo
  limit 1;
$$;

create or replace function atendimento.definir_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists agentes_definir_updated_at on atendimento.agentes;
create trigger agentes_definir_updated_at before update on atendimento.agentes for each row execute function atendimento.definir_updated_at();
drop trigger if exists canais_whatsapp_definir_updated_at on atendimento.canais_whatsapp;
create trigger canais_whatsapp_definir_updated_at before update on atendimento.canais_whatsapp for each row execute function atendimento.definir_updated_at();
drop trigger if exists perguntas_sem_resposta_definir_updated_at on atendimento.perguntas_sem_resposta;
create trigger perguntas_sem_resposta_definir_updated_at before update on atendimento.perguntas_sem_resposta for each row execute function atendimento.definir_updated_at();

-- Defesa em profundidade: o backend define app.empresa_id em cada transação.
alter table atendimento.agentes enable row level security;
alter table atendimento.canais_whatsapp enable row level security;
alter table atendimento.perguntas_sem_resposta enable row level security;
alter table atendimento.api_chaves enable row level security;
alter table atendimento.documentos enable row level security;
alter table atendimento.conversas enable row level security;
alter table atendimento.mensagens enable row level security;

drop policy if exists empresa_isolada on atendimento.agentes;
create policy empresa_isolada on atendimento.agentes using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
drop policy if exists empresa_isolada on atendimento.canais_whatsapp;
create policy empresa_isolada on atendimento.canais_whatsapp using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
drop policy if exists empresa_isolada on atendimento.perguntas_sem_resposta;
create policy empresa_isolada on atendimento.perguntas_sem_resposta using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
drop policy if exists empresa_isolada on atendimento.api_chaves;
create policy empresa_isolada on atendimento.api_chaves using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
drop policy if exists empresa_isolada on atendimento.documentos;
create policy empresa_isolada on atendimento.documentos using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
drop policy if exists empresa_isolada on atendimento.conversas;
create policy empresa_isolada on atendimento.conversas using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
drop policy if exists empresa_isolada on atendimento.mensagens;
create policy empresa_isolada on atendimento.mensagens using (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) with check (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'daza_atendimento_app') then
    grant usage on schema atendimento to daza_atendimento_app;
    grant select, insert, update on atendimento.agentes, atendimento.canais_whatsapp, atendimento.perguntas_sem_resposta, atendimento.api_chaves, atendimento.documentos, atendimento.conversas, atendimento.mensagens to daza_atendimento_app;
    grant execute on function atendimento.autenticar_api_chave(text, text), atendimento.resolver_canal_whatsapp(text), atendimento.registrar_saida(uuid, uuid, text, text), atendimento.finalizar_conversa(uuid, uuid, text, text, text) to daza_atendimento_app;
  end if;
end $$;

commit;
