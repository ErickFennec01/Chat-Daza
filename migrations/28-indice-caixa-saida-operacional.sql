-- Consulta operacional e reprocessamento manual da caixa de saída.
begin;

create index if not exists idx_entregas_mensagens__empresa_status_proxima_tentativa
  on atendimento.entregas_mensagens (empresa_id, status, proxima_tentativa_em asc nulls first, created_at desc);

commit;
