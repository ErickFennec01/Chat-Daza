-- Garante uma conversa ativa por empresa, canal e contato, inclusive sob webhooks simultâneos.
-- Execute como administrador de db_atendimento.
begin;

create unique index if not exists uq_conversas__contato_ativa
  on atendimento.conversas (empresa_id, canal, contato_externo)
  where status in ('aberta', 'aguardando_humano');

create or replace function atendimento.criar_conversa(
  p_empresa_id uuid,
  p_canal text,
  p_contato_externo text,
  p_chave_externa text default null,
  p_metadados jsonb default '{}'::jsonb
)
returns table(conversa_id uuid, status text, criada boolean)
language plpgsql security definer set search_path = atendimento, pg_temp as $$
declare
  v_id uuid;
  v_status text;
begin
  if not exists (select 1 from empresas e where e.id = p_empresa_id and e.ativo) then
    raise exception 'Empresa não encontrada ou inativa';
  end if;
  if p_canal not in ('webchat', 'whatsapp', 'email', 'instagram', 'outro') then
    raise exception 'Canal inválido';
  end if;

  if nullif(trim(p_chave_externa), '') is not null then
    select c.id, c.status into v_id, v_status
      from conversas c
     where c.empresa_id = p_empresa_id and c.chave_externa = trim(p_chave_externa);
    if found then
      return query select v_id, v_status, false;
      return;
    end if;
  end if;

  insert into conversas (empresa_id, canal, contato_externo, chave_externa, metadados)
  values (p_empresa_id, p_canal, p_contato_externo, nullif(trim(p_chave_externa), ''), coalesce(p_metadados, '{}'::jsonb))
  on conflict do nothing
  returning conversas.id, conversas.status into v_id, v_status;
  if found then
    return query select v_id, v_status, true;
    return;
  end if;

  -- Após aguardar uma colisão única, esta consulta enxerga o registro vencedor.
  select c.id, c.status into v_id, v_status
    from conversas c
   where c.empresa_id = p_empresa_id
     and (
       (nullif(trim(p_chave_externa), '') is not null and c.chave_externa = trim(p_chave_externa))
       or (c.canal = p_canal and c.contato_externo = p_contato_externo and c.status in ('aberta', 'aguardando_humano'))
     )
   order by c.updated_at desc
   limit 1;
  if found then
    return query select v_id, v_status, false;
    return;
  end if;

  raise exception 'Não foi possível criar ou recuperar a conversa ativa';
end;
$$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'daza_atendimento_app') then
    grant execute on function atendimento.criar_conversa(uuid, text, text, text, jsonb) to daza_atendimento_app;
  end if;
end $$;

commit;
