'use client';

import { FormEvent, useEffect, useState } from 'react';

type Queue = { id: string; nome: string; descricao: string; prioridade_padrao: number };

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`/api/backend/${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message ?? 'Não foi possível concluir a transferência.'); }
  return response.json();
}

export function Transferencias({ conversaId, status, onTransferred }: { conversaId?: string; status?: string; onTransferred: () => Promise<void> }) {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [queueId, setQueueId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { if (conversaId) void api('conversas/filas-disponiveis').then(setQueues).catch(() => setQueues([])); }, [conversaId]);
  if (!conversaId || status === 'encerrada' || status === 'resolvida') return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!queueId) return;
    setBusy(true); setMessage('');
    try {
      await api(`conversas/${conversaId}/transferir`, { method: 'POST', body: JSON.stringify({ filaId: queueId, motivo: reason.trim() || undefined }) });
      setReason(''); setQueueId(''); setMessage('Conversa transferida para a fila humana.'); await onTransferred();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível transferir a conversa.'); } finally { setBusy(false); }
  }
  return <section className="records wide"><h2>Transferir atendimento</h2>{queues.length === 0 ? <p className="muted">Não há filas humanas ativas para esta empresa.</p> : <form className="inline-form" onSubmit={submit}><select required value={queueId} onChange={(event) => setQueueId(event.target.value)}><option value="">Escolha a fila</option>{queues.map((queue) => <option key={queue.id} value={queue.id}>{queue.nome} · prioridade {queue.prioridade_padrao}</option>)}</select><input value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Motivo da transferência (opcional)" /><button disabled={busy || !queueId}>{busy ? 'Transferindo…' : 'Transferir'}</button></form>}{message && <p className="feedback" role="status">{message}</p>}</section>;
}
