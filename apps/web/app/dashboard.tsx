'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Agent = { id: string; nome: string; ativo: boolean; system_prompt: string; modelo: string; temperatura: number; limite_resposta_tokens: number; limiar_confianca: number };
type Document = { id: string; titulo: string; conteudo: string; fonte?: string | null; ativo: boolean };
type Question = { id: string; pergunta: string; motivo: string; status: string };
type Section = 'agentes' | 'conhecimento' | 'duvidas';

const blankAgent = { nome: '', systemPrompt: '', modelo: 'openrouter/free', temperatura: '0.2', limiteRespostaTokens: '450', limiarConfianca: '0.6', ativo: true };
const blankDocument = { titulo: '', conteudo: '', fonte: '', ativo: true };

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`/api/backend/${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? 'Não foi possível concluir a operação.');
  }
  return response.status === 204 ? null : response.json();
}

export function Dashboard() {
  const router = useRouter();
  const [section, setSection] = useState<Section>('agentes');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [agentForm, setAgentForm] = useState(blankAgent);
  const [documentForm, setDocumentForm] = useState(blankDocument);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState<string | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [nextAgents, nextDocuments, nextQuestions] = await Promise.all([api('agentes'), api('conhecimento/documentos'), api('perguntas-sem-resposta')]);
      setAgents(nextAgents); setDocuments(nextDocuments); setQuestions(nextQuestions);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Sua sessão expirou.'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function submitAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const payload = { nome: agentForm.nome, systemPrompt: agentForm.systemPrompt, modelo: agentForm.modelo, temperatura: Number(agentForm.temperatura), limiteRespostaTokens: Number(agentForm.limiteRespostaTokens), limiarConfianca: Number(agentForm.limiarConfianca), ativo: agentForm.ativo };
      await api(editingAgent ? `agentes/${editingAgent}` : 'agentes', { method: editingAgent ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setAgentForm(blankAgent); setEditingAgent(null); setMessage('Agente salvo.'); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar agente.'); } finally { setBusy(false); }
  }

  async function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await api(editingDocument ? `conhecimento/documentos/${editingDocument}` : 'conhecimento/documentos', { method: editingDocument ? 'PATCH' : 'POST', body: JSON.stringify(documentForm) });
      setDocumentForm(blankDocument); setEditingDocument(null); setMessage('Conhecimento salvo.'); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar conhecimento.'); } finally { setBusy(false); }
  }

  async function resolveQuestion(questionId: string) {
    const respostaCurada = draftAnswers[questionId]?.trim();
    if (!respostaCurada) { setMessage('Escreva uma resposta curada antes de concluir a dúvida.'); return; }
    setBusy(true); setMessage('');
    try {
      await api(`perguntas-sem-resposta/${questionId}`, { method: 'PATCH', body: JSON.stringify({ status: 'respondida', respostaCurada }) });
      setMessage('Dúvida respondida e pronta para virar conhecimento.'); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao atualizar dúvida.'); } finally { setBusy(false); }
  }

  async function logout() { await fetch('/api/session/logout', { method: 'POST' }); router.replace('/login'); router.refresh(); }

  return <main className="shell">
    <header className="topbar"><div><span className="brand">DAZA</span><span className="subtitle">Atendimento</span></div><button className="secondary" onClick={logout}>Sair</button></header>
    <section className="hero compact"><p className="eyebrow">CENTRAL MULTITENANT</p><h1>Controle o que a IA sabe e como ela atende.</h1><p>As informações desta tela são isoladas por empresa e persistidas no banco DAZA.</p></section>
    <nav className="tabs" aria-label="Módulos do atendimento"><button className={section === 'agentes' ? 'active' : ''} onClick={() => setSection('agentes')}>Agentes ({agents.length})</button><button className={section === 'conhecimento' ? 'active' : ''} onClick={() => setSection('conhecimento')}>Conhecimento ({documents.length})</button><button className={section === 'duvidas' ? 'active' : ''} onClick={() => setSection('duvidas')}>Dúvidas ({questions.filter((item) => item.status !== 'respondida').length})</button></nav>
    {message && <p className="feedback" role="status">{message}</p>}
    {section === 'agentes' && <section className="workbench"><form className="editor" onSubmit={submitAgent}><h2>{editingAgent ? 'Editar agente' : 'Novo agente'}</h2><label>Nome<input required value={agentForm.nome} onChange={(event) => setAgentForm({ ...agentForm, nome: event.target.value })} /></label><label>System prompt<textarea required value={agentForm.systemPrompt} onChange={(event) => setAgentForm({ ...agentForm, systemPrompt: event.target.value })} placeholder="Papel, limites, tom e quando escalar para humano." /></label><div className="field-row"><label>Modelo<input required value={agentForm.modelo} onChange={(event) => setAgentForm({ ...agentForm, modelo: event.target.value })} /></label><label>Temperatura<input required type="number" min="0" max="2" step="0.1" value={agentForm.temperatura} onChange={(event) => setAgentForm({ ...agentForm, temperatura: event.target.value })} /></label></div><div className="field-row"><label>Máx. tokens<input required type="number" min="64" max="2000" value={agentForm.limiteRespostaTokens} onChange={(event) => setAgentForm({ ...agentForm, limiteRespostaTokens: event.target.value })} /></label><label>Confiança mínima<input required type="number" min="0" max="1" step="0.05" value={agentForm.limiarConfianca} onChange={(event) => setAgentForm({ ...agentForm, limiarConfianca: event.target.value })} /></label></div><label className="check"><input type="checkbox" checked={agentForm.ativo} onChange={(event) => setAgentForm({ ...agentForm, ativo: event.target.checked })} /> Agente ativo</label><div className="actions"><button disabled={busy}>{busy ? 'Salvando…' : 'Salvar agente'}</button>{editingAgent && <button type="button" className="secondary" onClick={() => { setEditingAgent(null); setAgentForm(blankAgent); }}>Cancelar</button>}</div></form><aside className="records"><h2>Agentes cadastrados</h2>{agents.length === 0 ? <p className="muted">Crie o primeiro agente da empresa.</p> : agents.map((agent) => <article className="record" key={agent.id}><div><strong>{agent.nome}</strong><small>{agent.modelo} · {agent.ativo ? 'ativo' : 'inativo'}</small></div><div className="row-actions"><button className="link" onClick={() => { setEditingAgent(agent.id); setAgentForm({ nome: agent.nome, systemPrompt: agent.system_prompt, modelo: agent.modelo, temperatura: String(agent.temperatura), limiteRespostaTokens: String(agent.limite_resposta_tokens), limiarConfianca: String(agent.limiar_confianca), ativo: agent.ativo }); }}>Editar</button>{agent.ativo && <button className="link danger" onClick={async () => { await api(`agentes/${agent.id}`, { method: 'DELETE' }); await refresh(); }}>Desativar</button>}</div></article>)}</aside></section>}
    {section === 'conhecimento' && <section className="workbench"><form className="editor" onSubmit={submitDocument}><h2>{editingDocument ? 'Editar conhecimento' : 'Novo conhecimento'}</h2><label>Título<input required value={documentForm.titulo} onChange={(event) => setDocumentForm({ ...documentForm, titulo: event.target.value })} /></label><label>Conteúdo<textarea required value={documentForm.conteudo} onChange={(event) => setDocumentForm({ ...documentForm, conteudo: event.target.value })} placeholder="Políticas, catálogo, procedimentos, respostas aprovadas…" /></label><label>Fonte (opcional)<input value={documentForm.fonte} onChange={(event) => setDocumentForm({ ...documentForm, fonte: event.target.value })} /></label><label className="check"><input type="checkbox" checked={documentForm.ativo} onChange={(event) => setDocumentForm({ ...documentForm, ativo: event.target.checked })} /> Usar no RAG</label><div className="actions"><button disabled={busy}>{busy ? 'Salvando…' : 'Salvar conhecimento'}</button>{editingDocument && <button type="button" className="secondary" onClick={() => { setEditingDocument(null); setDocumentForm(blankDocument); }}>Cancelar</button>}</div></form><aside className="records"><h2>Base de conhecimento</h2>{documents.length === 0 ? <p className="muted">Ainda não há documentos para recuperação RAG.</p> : documents.map((document) => <article className="record" key={document.id}><div><strong>{document.titulo}</strong><small>{document.ativo ? 'ativo no RAG' : 'inativo'} · {document.fonte || 'sem fonte'}</small></div><div className="row-actions"><button className="link" onClick={() => { setEditingDocument(document.id); setDocumentForm({ titulo: document.titulo, conteudo: document.conteudo, fonte: document.fonte || '', ativo: document.ativo }); }}>Editar</button><button className="link danger" onClick={async () => { if (window.confirm(`Remover “${document.titulo}”?`)) { await api(`conhecimento/documentos/${document.id}`, { method: 'DELETE' }); await refresh(); } }}>Excluir</button></div></article>)}</aside></section>}
    {section === 'duvidas' && <section className="records wide"><h2>Dúvidas que exigem decisão humana</h2>{questions.length === 0 ? <p className="muted">Nenhuma dúvida registrada. Quando a IA escalar ou não encontrar contexto, ela aparece aqui.</p> : questions.map((question) => <article className="question" key={question.id}><p className="eyebrow">{question.motivo.replace('_', ' ')}</p><strong>{question.pergunta}</strong><small>Status: {question.status}</small>{question.status !== 'respondida' && <><textarea value={draftAnswers[question.id] ?? ''} onChange={(event) => setDraftAnswers({ ...draftAnswers, [question.id]: event.target.value })} placeholder="Resposta validada pela empresa" /><button disabled={busy} onClick={() => void resolveQuestion(question.id)}>Marcar como respondida</button></>}</article>)}</section>}
  </main>;
}
