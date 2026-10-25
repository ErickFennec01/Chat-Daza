-- Uma nova demanda deve iniciar uma conversa nova. O histórico encerrado permanece
-- disponível para auditoria, mas não é reaberto automaticamente e não volta ao prompt.
begin;

alter table atendimento.politicas_atendimento
  alter column janela_reabertura_minutos set default 0;

-- A instalação inicial usava 24 horas como padrão. A migração aplica a política
-- segura de nova conversa às políticas que ainda têm esse valor padrão.
update atendimento.politicas_atendimento
set janela_reabertura_minutos = 0,
    atualizado_em = now()
where janela_reabertura_minutos = 1440;

-- Também cobre empresas que ainda não abriram a tela de política e, por isso,
-- não possuem uma linha em politicas_atendimento.
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

  select coalesce(p.janela_reabertura_minutos, 0) into v_janela
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

commit;
