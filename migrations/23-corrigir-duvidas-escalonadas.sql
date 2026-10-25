-- Substitui mensagens técnicas antigas pela última pergunta real do cliente.
begin;

update atendimento.perguntas_sem_resposta p
set pergunta = (
  select m.conteudo from atendimento.mensagens m
  where m.empresa_id=p.empresa_id and m.conversa_id=p.conversa_id and m.direcao='entrada'
  order by m.created_at desc limit 1
)
where p.motivo='escalonamento'
  and p.pergunta in ('Falha ao interpretar a resposta do modelo', 'Resposta estruturada inválida do modelo', 'Solicitação exige atendimento humano')
  and exists (
    select 1 from atendimento.mensagens m
    where m.empresa_id=p.empresa_id and m.conversa_id=p.conversa_id and m.direcao='entrada' and length(trim(m.conteudo)) > 0
  );

commit;
