'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Agent = { id: string; nome: string; ativo: boolean; system_prompt: string; modelo: string; temperatura: number; limite_resposta_tokens: number; limiar_confianca: number };
type Document = { id: string; titulo: string; conteudo: string; fonte?: string | null; ativo: boolean };
type Question = { id: string; pergunta: string; motivo: string; status: string };
type Conversation = { id: string; canal: string; contato_externo: string; status: string; atendida_por_usuario_id?: string | null; ultima_mensagem?: string | null; ultima_mensagem_direcao?: string | null };
type ConversationDetail = Conversation & { resumo_final?: string | null; codigo_resolucao?: string | null; mensagens: Array<{ id: string; direcao: string; conteudo: string; modelo?: string | null; created_at: string }> };
type Metrics = { conversas_ativas: number; aguardando_humano: number; conversas_7_dias: number; execucoes_ia_7_dias: number; tokens_ia_7_dias: number; duvidas_abertas: number };
type WhatsAppChannel = { id: string; agente_id: string; sessao_waha: string; display_name?: string | null; ativo: boolean };
type WhatsAppChannelStatus = { estado: 'conectado' | 'aguardando_qr' | 'conectando' | 'desconectado' | 'indisponivel'; statusWaha: string | null };
type Section = 'agentes' | 'conhecimento' | 'duvidas' | 'conversas' | 'canais';

const blankAgent = { nome: '', systemPrompt: '', modelo: 'openrouter/free', temperatura: '0.2', limiteRespostaTokens: '450', limiarConfianca: '0.6', ativo: true };
const blankDocument = { titulo: '', conteudo: '', fonte: '', ativo: true };
const blankChannel = { agenteId: '', sessao: '', displayName: '', ativo: true };

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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [channels, setChannels] = useState<WhatsAppChannel[]>([]);
  const [channelStatuses, setChannelStatuses] = useState<Record<string, WhatsAppChannelStatus>>({});
  const [agentForm, setAgentForm] = useState(blankAgent);
  const [documentForm, setDocumentForm] = useState(blankDocument);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState<string | null>(null);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [channelForm, setChannelForm] = useState(blankChannel);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [humanReply, setHumanReply] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [nextAgents, nextDocuments, nextQuestions, nextConversations, nextMetrics, nextChannels] = await Promise.all([api('agentes'), api('conhecimento/documentos'), api('perguntas-sem-resposta'), api('conversas'), api('metricas'), api('canais/whatsapp')]);
      setAgents(nextAgents); setDocuments(nextDocuments); setQuestions(nextQuestions); setConversations(nextConversations); setMetrics(nextMetrics); setChannels(nextChannels);
      const statuses = await Promise.all(nextChannels.map(async (channel: WhatsAppChannel) => [channel.id, await api(`canais/whatsapp/${channel.id}/status`).catch(() => ({ estado: 'indisponivel', statusWaha: null }))] as const));
      setChannelStatuses(Object.fromEntries(statuses));
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

  async function submitChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const payload = editingChannel
        ? { agenteId: channelForm.agenteId, displayName: channelForm.displayName || undefined, ativo: channelForm.ativo }
        : { agenteId: channelForm.agenteId, sessao: channelForm.sessao, displayName: channelForm.displayName || undefined };
      await api(editingChannel ? `canais/whatsapp/${editingChannel}` : 'canais/whatsapp', { method: editingChannel ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setChannelForm(blankChannel); setEditingChannel(null); setMessage('Canal WhatsApp salvo. O token não fica disponível para leitura.'); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar canal.'); } finally { setBusy(false); }
  }

  async function connectChannel(id: string) {
    setBusy(true); setMessage(''); setQrDataUrl(null);
    try {
      const result = await api(`canais/whatsapp/${id}/conectar`, { method: 'POST' });
      setQrDataUrl(result.qrDataUrl); setChannelStatuses((current) => ({ ...current, [id]: { estado: 'aguardando_qr', statusWaha: 'SCAN_QR_CODE' } })); setMessage('Escaneie o QR Code no WhatsApp do número que será usado no atendimento.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível iniciar o pareamento WAHA.'); } finally { setBusy(false); }
  }

  async function refreshChannelStatus(id: string) {
    setBusy(true); setMessage('');
    try {
      const status = await api(`canais/whatsapp/${id}/status`);
      setChannelStatuses((current) => ({ ...current, [id]: status }));
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível consultar o WAHA.'); }
    finally { setBusy(false); }
  }

  async function logout() { await fetch('/api/session/logout', { method: 'POST' }); router.replace('/login'); router.refresh(); }
  async function openConversation(id: string) {
    try { setSelectedConversation(await api(`conversas/${id}`)); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível abrir a conversa.'); }
  }
  async function assumeConversation(id: string) {
    setBusy(true); setMessage('');
    try { await api(`conversas/${id}/assumir`, { method: 'POST' }); setMessage('Atendimento atribuído a você.'); await refresh(); await openConversation(id); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível assumir a conversa.'); } finally { setBusy(false); }
  }
  async function sendHumanReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const conteudo = humanReply.trim();
    if (!selectedConversation || !conteudo) { setMessage('Escreva uma mensagem antes de enviar.'); return; }
    setBusy(true); setMessage('');
    try {
      await api(`conversas/${selectedConversation.id}/mensagens`, { method: 'POST', body: JSON.stringify({ conteudo }) });
      setHumanReply(''); setMessage('Mensagem enviada pelo canal oficial.'); await refresh(); await openConversation(selectedConversation.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.'); } finally { setBusy(false); }
  }

  return <main className="shell">
    <header className="topbar"><div className="topbar-context"><span className="status-dot" /><div><p className="topbar-kicker">DAZA ERP • TERMINAL OPERACIONAL</p><span className="topbar-title">Central de Atendimento</span></div></div><button className="secondary" onClick={logout}>Encerrar sessão</button></header>
    <section className="hero compact"><p className="eyebrow">CENTRAL MULTITENANT</p><h1>Controle o que a IA sabe e como ela atende.</h1><p>As informações desta tela são isoladas por empresa e persistidas no banco DAZA.</p></section>
    <nav className="tabs" aria-label="Módulos do atendimento"><div className="sidebar-brand"><span className="brand">DAZA</span><span className="sidebar-product">ERP <i /> Atendimento</span></div><p className="nav-label">Central de IA</p><button className={section === 'agentes' ? 'active' : ''} onClick={() => setSection('agentes')}>Agentes <em>{agents.length}</em></button><button className={section === 'conhecimento' ? 'active' : ''} onClick={() => setSection('conhecimento')}>Conhecimento <em>{documents.length}</em></button><button className={section === 'duvidas' ? 'active' : ''} onClick={() => setSection('duvidas')}>Dúvidas <em>{questions.filter((item) => item.status !== 'respondida').length}</em></button><button className={section === 'conversas' ? 'active' : ''} onClick={() => setSection('conversas')}>Conversas <em>{metrics?.conversas_ativas ?? 0}</em></button><button className={section === 'canais' ? 'active' : ''} onClick={() => setSection('canais')}>Canais <em>{channels.filter((item) => item.ativo).length}</em></button><div className="sidebar-status"><span className="status-dot" /> Ambiente privado</div></nav>
    {message && <p className="feedback" role="status">{message}</p>}
    {metrics && <section className="metrics" aria-label="Métricas dos últimos sete dias"><article><strong>{metrics.conversas_ativas}</strong><span>conversas ativas</span></article><article><strong>{metrics.aguardando_humano}</strong><span>na fila humana</span></article><article><strong>{metrics.execucoes_ia_7_dias}</strong><span>execuções IA · 7 dias</span></article><article><strong>{metrics.duvidas_abertas}</strong><span>dúvidas abertas</span></article></section>}
    {section === 'agentes' && <section className="workbench"><form className="editor" onSubmit={submitAgent}><h2>{editingAgent ? 'Editar agente' : 'Novo agente'}</h2><label>Nome<input required value={agentForm.nome} onChange={(event) => setAgentForm({ ...agentForm, nome: event.target.value })} /></label><label>System prompt<textarea required value={agentForm.systemPrompt} onChange={(event) => setAgentForm({ ...agentForm, systemPrompt: event.target.value })} placeholder="Papel, limites, tom e quando escalar para humano." /></label><div className="field-row"><label>Modelo<input required value={agentForm.modelo} onChange={(event) => setAgentForm({ ...agentForm, modelo: event.target.value })} /></label><label>Temperatura<input required type="number" min="0" max="2" step="0.1" value={agentForm.temperatura} onChange={(event) => setAgentForm({ ...agentForm, temperatura: event.target.value })} /></label></div><div className="field-row"><label>Máx. tokens<input required type="number" min="64" max="2000" value={agentForm.limiteRespostaTokens} onChange={(event) => setAgentForm({ ...agentForm, limiteRespostaTokens: event.target.value })} /></label><label>Confiança mínima<input required type="number" min="0" max="1" step="0.05" value={agentForm.limiarConfianca} onChange={(event) => setAgentForm({ ...agentForm, limiarConfianca: event.target.value })} /></label></div><label className="check"><input type="checkbox" checked={agentForm.ativo} onChange={(event) => setAgentForm({ ...agentForm, ativo: event.target.checked })} /> Agente ativo</label><div className="actions"><button disabled={busy}>{busy ? 'Salvando…' : 'Salvar agente'}</button>{editingAgent && <button type="button" className="secondary" onClick={() => { setEditingAgent(null); setAgentForm(blankAgent); }}>Cancelar</button>}</div></form><aside className="records"><h2>Agentes cadastrados</h2>{agents.length === 0 ? <p className="muted">Crie o primeiro agente da empresa.</p> : agents.map((agent) => <article className="record" key={agent.id}><div><strong>{agent.nome}</strong><small>{agent.modelo} · {agent.ativo ? 'ativo' : 'inativo'}</small></div><div className="row-actions"><button className="link" onClick={() => { setEditingAgent(agent.id); setAgentForm({ nome: agent.nome, systemPrompt: agent.system_prompt, modelo: agent.modelo, temperatura: String(agent.temperatura), limiteRespostaTokens: String(agent.limite_resposta_tokens), limiarConfianca: String(agent.limiar_confianca), ativo: agent.ativo }); }}>Editar</button>{agent.ativo && <button className="link danger" onClick={async () => { await api(`agentes/${agent.id}`, { method: 'DELETE' }); await refresh(); }}>Desativar</button>}</div></article>)}</aside></section>}
    {section === 'conhecimento' && <section className="workbench"><form className="editor" onSubmit={submitDocument}><h2>{editingDocument ? 'Editar conhecimento' : 'Novo conhecimento'}</h2><label>Título<input required value={documentForm.titulo} onChange={(event) => setDocumentForm({ ...documentForm, titulo: event.target.value })} /></label><label>Conteúdo<textarea required value={documentForm.conteudo} onChange={(event) => setDocumentForm({ ...documentForm, conteudo: event.target.value })} placeholder="Políticas, catálogo, procedimentos, respostas aprovadas…" /></label><label>Fonte (opcional)<input value={documentForm.fonte} onChange={(event) => setDocumentForm({ ...documentForm, fonte: event.target.value })} /></label><label className="check"><input type="checkbox" checked={documentForm.ativo} onChange={(event) => setDocumentForm({ ...documentForm, ativo: event.target.checked })} /> Usar no RAG</label><div className="actions"><button disabled={busy}>{busy ? 'Salvando…' : 'Salvar conhecimento'}</button>{editingDocument && <button type="button" className="secondary" onClick={() => { setEditingDocument(null); setDocumentForm(blankDocument); }}>Cancelar</button>}</div></form><aside className="records"><h2>Base de conhecimento</h2>{documents.length === 0 ? <p className="muted">Ainda não há documentos para recuperação RAG.</p> : documents.map((document) => <article className="record" key={document.id}><div><strong>{document.titulo}</strong><small>{document.ativo ? 'ativo no RAG' : 'inativo'} · {document.fonte || 'sem fonte'}</small></div><div className="row-actions"><button className="link" onClick={() => { setEditingDocument(document.id); setDocumentForm({ titulo: document.titulo, conteudo: document.conteudo, fonte: document.fonte || '', ativo: document.ativo }); }}>Editar</button><button className="link danger" onClick={async () => { if (window.confirm(`Remover “${document.titulo}”?`)) { await api(`conhecimento/documentos/${document.id}`, { method: 'DELETE' }); await refresh(); } }}>Excluir</button></div></article>)}</aside></section>}
    {section === 'duvidas' && <section className="records wide"><h2>Dúvidas que exigem decisão humana</h2>{questions.length === 0 ? <p className="muted">Nenhuma dúvida registrada. Quando a IA escalar ou não encontrar contexto, ela aparece aqui.</p> : questions.map((question) => <article className="question" key={question.id}><p className="eyebrow">{question.motivo.replace('_', ' ')}</p><strong>{question.pergunta}</strong><small>Status: {question.status}</small>{question.status !== 'respondida' && <><textarea value={draftAnswers[question.id] ?? ''} onChange={(event) => setDraftAnswers({ ...draftAnswers, [question.id]: event.target.value })} placeholder="Resposta validada pela empresa" /><button disabled={busy} onClick={() => void resolveQuestion(question.id)}>Marcar como respondida</button></>}</article>)}</section>}
    {section === 'conversas' && <section className="conversation-layout"><aside className="records"><h2>Atendimentos recentes</h2>{conversations.length === 0 ? <p className="muted">Nenhuma conversa registrada ainda.</p> : conversations.map((conversation) => <article className="record conversation-record" key={conversation.id}><button className="record-main" onClick={() => void openConversation(conversation.id)}><strong>{conversation.contato_externo}</strong><small>{conversation.canal} · {conversation.status.replace('_', ' ')}</small><small>{conversation.ultima_mensagem_direcao === 'entrada' ? 'Cliente: ' : 'Equipe: '}{conversation.ultima_mensagem || 'Sem mensagens'}</small></button><div className="row-actions">{conversation.status !== 'resolvida' && conversation.status !== 'encerrada' && !conversation.atendida_por_usuario_id && <button className="link" disabled={busy} onClick={() => void assumeConversation(conversation.id)}>Assumir</button>}</div></article>)}</aside><section className="conversation-detail"><h2>{selectedConversation ? selectedConversation.contato_externo : 'Selecione uma conversa'}</h2>{selectedConversation ? <><p className="muted">{selectedConversation.canal} · {selectedConversation.status.replace('_', ' ')}{selectedConversation.atendida_por_usuario_id ? ' · atendimento humano assumido' : ''}</p><div className="timeline">{selectedConversation.mensagens.map((item) => <article className={`message ${item.direcao}`} key={item.id}><small>{item.direcao === 'entrada' ? 'Cliente' : item.modelo?.startsWith('humano:') ? 'Equipe' : 'IA'}</small><p>{item.conteudo}</p></article>)}</div>{selectedConversation.status === 'aguardando_humano' && selectedConversation.atendida_por_usuario_id ? <form className="human-composer" onSubmit={sendHumanReply}><label>Responder como equipe<textarea required value={humanReply} onChange={(event) => setHumanReply(event.target.value)} placeholder="Escreva a resposta que será enviada pelo WhatsApp oficial." /></label><div className="actions"><button disabled={busy || !humanReply.trim()}>{busy ? 'Enviando…' : 'Enviar mensagem'}</button></div></form> : <p className="notice"><strong>Atendimento pela IA.</strong> Assuma esta conversa para pausar a IA e responder diretamente ao cliente.</p>}</> : <p className="muted">Abra uma conversa para consultar o histórico e assumir a fila humana.</p>}</section></section>}
    {section === 'canais' && <section className="workbench"><form className="editor" onSubmit={submitChannel}><h2>{editingChannel ? 'Editar canal WAHA' : 'Conectar WhatsApp por WAHA'}</h2>{agents.length === 0 ? <p className="feedback">Crie e ative um agente antes de conectar um número.</p> : <><label>Agente responsável<select required value={channelForm.agenteId} onChange={(event) => setChannelForm({ ...channelForm, agenteId: event.target.value })}><option value="">Selecione um agente</option>{agents.filter((agent) => agent.ativo).map((agent) => <option key={agent.id} value={agent.id}>{agent.nome}</option>)}</select></label><label>Nome da sessão WAHA<input required disabled={Boolean(editingChannel)} pattern="[a-z0-9][a-z0-9-]{2,79}" value={channelForm.sessao} onChange={(event) => setChannelForm({ ...channelForm, sessao: event.target.value.toLowerCase() })} placeholder="dazaerp-suporte" /><small>Use letras minúsculas, números e hífen. Depois de salvar, gere o QR Code para parear o número.</small></label><label>Nome de exibição<input value={channelForm.displayName} onChange={(event) => setChannelForm({ ...channelForm, displayName: event.target.value })} /></label><label className="check"><input type="checkbox" checked={channelForm.ativo} onChange={(event) => setChannelForm({ ...channelForm, ativo: event.target.checked })} /> Canal ativo</label><div className="actions"><button disabled={busy}>{busy ? 'Salvando…' : 'Salvar canal'}</button>{editingChannel && <button type="button" className="secondary" onClick={() => { setEditingChannel(null); setChannelForm(blankChannel); }}>Cancelar</button>}</div></>}</form><aside className="records"><h2>Números conectados</h2><p className="muted">WAHA é pareado por QR Code; nenhum token Meta é solicitado.</p>{channels.length === 0 ? <p className="muted">Nenhum número WhatsApp conectado.</p> : channels.map((channel) => { const status = channelStatuses[channel.id]; const statusLabel = { conectado: 'Conectado', aguardando_qr: 'Aguardando QR', conectando: 'Conectando', desconectado: 'Desconectado', indisponivel: 'Indisponível' }[status?.estado ?? 'indisponivel']; return <article className="record" key={channel.id}><div><strong>{channel.display_name || channel.sessao_waha}</strong><small>{channel.ativo ? 'ativo' : 'inativo'} · sessão {channel.sessao_waha}</small><span className={`connection-state ${status?.estado ?? 'indisponivel'}`}>{statusLabel}</span></div><div className="row-actions"><button className="link" disabled={busy || !channel.ativo} onClick={() => void refreshChannelStatus(channel.id)}>Atualizar status</button><button className="link" disabled={busy || !channel.ativo} onClick={() => void connectChannel(channel.id)}>Gerar QR</button><button className="link" onClick={() => { setQrDataUrl(null); setEditingChannel(channel.id); setChannelForm({ agenteId: channel.agente_id, sessao: channel.sessao_waha, displayName: channel.display_name || '', ativo: channel.ativo }); }}>Editar</button>{channel.ativo && <button className="link danger" disabled={busy} onClick={async () => { await api(`canais/whatsapp/${channel.id}`, { method: 'DELETE' }); await refresh(); }}>Desativar</button>}</div></article>; })}{qrDataUrl && <div className="qr-panel"><h3>Escaneie este QR Code</h3><img src={qrDataUrl} alt="QR Code para parear WhatsApp no WAHA" /><p className="muted">No WhatsApp: Dispositivos conectados → Conectar dispositivo.</p></div>}</aside></section>}
  </main>;
}
