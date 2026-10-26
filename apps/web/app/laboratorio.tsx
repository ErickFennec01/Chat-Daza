'use client';

import { FormEvent, useEffect, useState } from 'react';

type Agent = { id: string; nome: string; ativo: boolean };
type Simulation = { id: string; agente_id: string; agente_nome: string; titulo: string; status: string; mensagens: number };
type Detail = Simulation & { mensagens: Array<{ id: string; papel: string; conteudo: string; modelo?: string | null; rag_contexto?: string | null }> };

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`/api/backend/${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message ?? 'Não foi possível concluir a simulação.'); }
  return response.json();
}

export function Laboratorio() {
  const [agents, setAgents] = useState<Agent[]>([]); const [simulations, setSimulations] = useState<Simulation[]>([]); const [selected, setSelected] = useState<Detail | null>(null);
  const [agentId, setAgentId] = useState(''); const [title, setTitle] = useState('Teste de agente'); const [message, setMessage] = useState(''); const [feedback, setFeedback] = useState(''); const [busy, setBusy] = useState(false);
  const load = async () => { const [nextAgents, nextSimulations] = await Promise.all([api('agentes'), api('laboratorio/simulacoes')]); setAgents(nextAgents.filter((agent: Agent) => agent.ativo)); setSimulations(nextSimulations); };
  useEffect(() => { void load().catch((error) => setFeedback(error instanceof Error ? error.message : 'Não foi possível carregar o laboratório.')); }, []);
  async function open(id: string) { try { setSelected(await api(`laboratorio/simulacoes/${id}`)); } catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível abrir a simulação.'); } }
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setFeedback(''); try { const created = await api('laboratorio/simulacoes', { method: 'POST', body: JSON.stringify({ agenteId: agentId, titulo: title }) }); await load(); await open(created.id); } catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível criar a simulação.'); } finally { setBusy(false); } }
  async function send(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected || !message.trim()) return; setBusy(true); setFeedback(''); try { await api(`laboratorio/simulacoes/${selected.id}/mensagens`, { method: 'POST', body: JSON.stringify({ conteudo: message.trim() }) }); setMessage(''); await open(selected.id); await load(); } catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível executar o modelo.'); } finally { setBusy(false); } }
  return <section className="conversation-layout"><aside className="records"><h2>Laboratório de IA</h2><form className="inline-form" onSubmit={create}><select required value={agentId} onChange={(event) => setAgentId(event.target.value)}><option value="">Escolha o agente</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.nome}</option>)}</select><input required value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} /><button disabled={busy || !agentId}>Nova simulação</button></form><p className="muted">Nenhuma mensagem é enviada ao WhatsApp, n8n ou filas humanas.</p>{simulations.map((simulation) => <article className="record" key={simulation.id}><button className="record-main" onClick={() => void open(simulation.id)}><strong>{simulation.titulo}</strong><small>{simulation.agente_nome} · {simulation.mensagens} mensagens</small></button></article>)}</aside><section className="conversation-detail"><h2>{selected?.titulo || 'Selecione uma simulação'}</h2>{selected ? <><p className="notice">Ambiente isolado: usa prompt, roteiro e RAG do agente, sem atendimento real.</p><div className="timeline">{selected.mensagens.map((item) => <article className={`message ${item.papel === 'usuario' ? 'entrada' : 'saida'}`} key={item.id}><small>{item.papel === 'usuario' ? 'Cliente simulado' : 'IA'}</small><p>{item.conteudo}</p>{item.rag_contexto && <small>RAG utilizado nesta resposta</small>}</article>)}</div><form className="human-composer" onSubmit={send}><label>Mensagem de teste<textarea required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escreva como se fosse o cliente." /></label><button disabled={busy || !message.trim()}>{busy ? 'Testando…' : 'Enviar para IA'}</button></form></> : <p className="muted">Crie uma simulação para testar um agente antes da produção.</p>}{feedback && <p className="feedback" role="status">{feedback}</p>}</section></section>;
}
