-- Corrige a implantação inicial da versão 16 em bancos que já possuíam
-- o gatilho legado com o mesmo comportamento.
begin;

drop trigger if exists documentos_incrementar_versao_conhecimento on atendimento.documentos;

commit;
