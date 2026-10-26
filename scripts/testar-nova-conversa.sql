-- Teste de regressão seguro: toda alteração é revertida no final.
-- Execute no db_atendimento como administrador:
-- Get-Content scripts\testar-nova-conversa.sql | docker exec -i daza-erp-db-1 psql -v ON_ERROR_STOP=1 -U postgres -d db_atendimento
begin;

do $$
declare
  v_empresa uuid;
  v_primeira uuid;
  v_segunda uuid;
begin
  insert into atendimento.empresas (razao_social, slug)
  values ('Homologacao Isolada', 'homologacao-isolada')
  returning id into v_empresa;

  insert into atendimento.integracoes_canais (empresa_id, canal, identificador_destino)
  values (v_empresa, 'whatsapp', 'homologacao-destino');

  select conversa_id into v_primeira
  from atendimento.resolver_inbound('whatsapp', 'homologacao-destino', 'contato-sintetico', 'evento-1', '{}'::jsonb);

  perform atendimento.registrar_mensagem_entrada(v_empresa, v_primeira, 'mensagem-1', 'contexto anterior sintético');
  update atendimento.conversas
     set status = 'encerrada', encerrada_at = now(), updated_at = now()
   where id = v_primeira;

  select conversa_id into v_segunda
  from atendimento.resolver_inbound('whatsapp', 'homologacao-destino', 'contato-sintetico', 'evento-2', '{}'::jsonb);

  if v_primeira = v_segunda then
    raise exception 'A nova entrada reutilizou a conversa encerrada';
  end if;
  if exists (select 1 from atendimento.mensagens where conversa_id = v_segunda) then
    raise exception 'A nova conversa recebeu memória anterior';
  end if;
end $$;

rollback;
