-- Toda alteração na base de conhecimento cria uma nova versão de cache RAG
-- para os agentes do mesmo tenant. Chaves Redis antigas expiram naturalmente.
begin;

create or replace function atendimento.incrementar_versao_conhecimento()
returns trigger
language plpgsql
set search_path = atendimento, pg_temp
as $$
declare
  v_empresa_id uuid;
begin
  v_empresa_id := coalesce(new.empresa_id, old.empresa_id);

  update agentes
     set versao_conhecimento = versao_conhecimento + 1
   where empresa_id = v_empresa_id;

  return null;
end;
$$;

drop trigger if exists documentos_incrementam_versao_conhecimento on atendimento.documentos;
drop trigger if exists documentos_incrementar_versao_conhecimento on atendimento.documentos;
create trigger documentos_incrementam_versao_conhecimento
after insert or update of titulo, conteudo, fonte, ativo or delete on atendimento.documentos
for each row execute function atendimento.incrementar_versao_conhecimento();

commit;
