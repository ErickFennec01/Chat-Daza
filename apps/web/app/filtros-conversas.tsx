'use client';

type Status = '' | 'aberta' | 'aguardando_humano' | 'encerrada' | 'resolvida';

const options: Array<{ value: Status; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'aberta', label: 'IA ativa' },
  { value: 'aguardando_humano', label: 'Fila humana' },
  { value: 'encerrada', label: 'Encerradas' },
  { value: 'resolvida', label: 'Resolvidas' },
];

export function FiltrosConversas({ value, onChange }: { value: Status; onChange: (value: Status) => void }) {
  return <section className="records wide"><h2>Filtrar atendimentos</h2><div className="row-actions">{options.map((option) => <button key={option.label} type="button" className={value === option.value ? '' : 'secondary'} onClick={() => onChange(option.value)}>{option.label}</button>)}</div></section>;
}
