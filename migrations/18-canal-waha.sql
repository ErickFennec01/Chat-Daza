-- WAHA Core: sessões WhatsApp autocontroladas, uma por canal/empresa.
begin;

alter table atendimento.canais_whatsapp
  drop constraint if exists canais_whatsapp_provedor_check;
alter table atendimento.canais_whatsapp
  add constraint canais_whatsapp_provedor_check
  check (provedor in ('meta_cloud', 'evolution', 'outro', 'waha'));

alter table atendimento.canais_whatsapp
  add column if not exists sessao_waha text;
create unique index if not exists uq_canais_whatsapp__sessao_waha
  on atendimento.canais_whatsapp (sessao_waha)
  where sessao_waha is not null;

alter table atendimento.entregas_mensagens
  drop constraint if exists entregas_mensagens_provedor_check;
alter table atendimento.entregas_mensagens
  add constraint entregas_mensagens_provedor_check
  check (provedor in ('meta_cloud', 'waha'));

create or replace function atendimento.resolver_canal_waha(p_sessao_waha text)
returns table(empresa_id uuid, canal_id uuid, agente_id uuid, provedor text)
language sql security definer stable set search_path = atendimento, pg_temp as $$
  select empresa_id, id, agente_id, provedor
    from canais_whatsapp
   where sessao_waha = trim(p_sessao_waha)
     and provedor = 'waha'
     and ativo
   limit 1;
$$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'daza_atendimento_app') then
    grant execute on function atendimento.resolver_canal_waha(text) to daza_atendimento_app;
  end if;
end $$;

commit;
