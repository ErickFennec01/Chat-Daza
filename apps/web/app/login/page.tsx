'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setEnviando(true); setErro('');
    try {
      const response = await fetch('/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message ?? 'Não foi possível entrar.'); }
      router.replace('/'); router.refresh();
    } catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível entrar.'); } finally { setEnviando(false); }
  }
  return <main className="login-shell"><section className="login-card"><span className="brand">DAZA</span><p className="eyebrow">ATENDIMENTO MULTITENANT</p><h1>Entre no painel da sua empresa.</h1><p className="muted">A sessão é mantida em cookie protegido; tokens e chaves não chegam ao navegador.</p><form onSubmit={submit}><label>E-mail<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Senha<input type="password" required autoComplete="current-password" value={senha} onChange={(event) => setSenha(event.target.value)} /></label>{erro && <p className="feedback">{erro}</p>}<button disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button></form></section></main>;
}
