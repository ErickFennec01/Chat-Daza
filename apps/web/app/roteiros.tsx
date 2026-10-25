'use client';

import { FormEvent, useEffect, useState } from 'react';

type Script = { id: string; nome: string; descricao: string; etapas: Array<{ id: string; titulo: string; objetivo: string }>; ativo: boolean };
const blank = { nome: '', descricao: '', etapas: 'Boas-vindas | Entender a necessidade do cliente\nQualificacao | Coletar informações necessárias\nEncerramento | Confirmar solução ou transferir para humano' };

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`/api/backend/${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message ?? 'Não foi possível concluir a operação.'); }
  return response.json();
}

function parseSteps(text: string) {
  const etapas = text.split('\n').map((line, index) => {
    const [titulo, ...objetivo] = line.split('|');
    const cleanTitle = titulo?.trim();
    const cleanObjective = objetivo.join('|').trim();
    if (!cleanTitle || !cleanObjective) throw new Error(`Preencha título e objetivo na etapa ${index + 1}.`);
    return { id: `etapa-${index + 1}`, titulo: cleanTitle, objetivo: cleanObjective };
  }).filter(Boolean);
  if (!etapas.length) throw new Error('Inclua ao menos uma etapa.');
  return etapas;
}

export function Roteiros() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = async () => { try { setScripts(await api('roteiros')); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível carregar roteiros.'); } };
  useEffect(() => { void load(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await api(editing ? `roteiros/${editing}` : 'roteiros', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ nome: form.nome, descricao: form.descricao, etapas: parseSteps(form.etapas), ativo: true }) }); setForm(blank); setEditing(null); setMessage('Roteiro salvo e disponível para vincular a agentes.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o roteiro.'); } finally { setBusy(false); }
  }
  return <section className="workbench"><form className="editor" onSubmit={submit}><h2>{editing ? 'Editar roteiro' : 'Novo roteiro'}</h2><label>Nome<input required value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Ex.: Qualificação comercial" /></label><label>Descrição<textarea value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} placeholder="Quando este roteiro deve ser usado." /></label><label>Etapas do atendimento<textarea required value={form.etapas} onChange={(event) => setForm({ ...form, etapas: event.target.value })} /><small>Uma por linha: <code>Título | objetivo da etapa</code>. A IA avança somente após cumprir o objetivo ou transfere conforme o prompt.</small></label><div className="actions"><button disabled={busy}>{busy ? 'Salvando…' : 'Salvar roteiro'}</button>{editing && <button type="button" className="secondary" onClick={() => { setEditing(null); setForm(blank); }}>Cancelar</button>}</div>{message && <p className="feedback" role="status">{message}</p>}</form><aside className="records"><h2>Roteiros cadastrados</h2>{scripts.length === 0 ? <p className="muted">Crie o primeiro roteiro para orientar os agentes.</p> : scripts.map((script) => <article className="record" key={script.id}><div><strong>{script.nome}</strong><small>{script.etapas.length} etapas · {script.ativo ? 'ativo' : 'inativo'}</small><small>{script.etapas.map((etapa) => etapa.titulo).join(' → ')}</small></div><button className="link" onClick={() => { setEditing(script.id); setForm({ nome: script.nome, descricao: script.descricao, etapas: script.etapas.map((etapa) => `${etapa.titulo} | ${etapa.objetivo}`).join('\n') }); }}>Editar</button></article>)}</aside></section>;
}
