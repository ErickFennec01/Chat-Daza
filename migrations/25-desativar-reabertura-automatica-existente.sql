-- O MVP adota conversa nova por padrão. Empresas podem habilitar reabertura
-- conscientemente depois, configurando uma janela maior que zero na Operação.
begin;

update atendimento.politicas_atendimento
set janela_reabertura_minutos = 0,
    atualizado_em = now()
where janela_reabertura_minutos > 0;

commit;
