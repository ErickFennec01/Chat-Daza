const cards = [
  ['Agentes', 'Configure o system prompt, modelo, limites e política de escalonamento.'],
  ['Conhecimento', 'Cadastre documentos que alimentam o RAG de cada empresa.'],
  ['Dúvidas pendentes', 'Revise o que a IA não soube responder e transforme em conhecimento.'],
  ['Conversas', 'Acompanhe sessões e assuma os atendimentos escalados.'],
  ['Canais', 'Conecte o WhatsApp oficial e escolha o agente padrão do número.'],
];

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <div><span className="brand">DAZA</span><span className="subtitle">Atendimento</span></div>
        <span className="badge">MVP · ambiente privado</span>
      </header>
      <section className="hero">
        <p className="eyebrow">CENTRAL MULTITENANT</p>
        <h1>Atendimento com IA que sua empresa controla.</h1>
        <p>Configure agentes, conhecimento e exceções. A IA atende; sua equipe mantém a decisão final.</p>
      </section>
      <section className="notice">
        <strong>Autenticação ainda não conectada.</strong> O próximo incremento liga esta interface ao BFF autenticado; tokens de tenant não ficam no navegador.
      </section>
      <section className="grid" aria-label="Módulos da plataforma">
        {cards.map(([title, description]) => (
          <article className="card" key={title}>
            <div className="card-dot" aria-hidden="true" />
            <h2>{title}</h2>
            <p>{description}</p>
            <button disabled aria-label={`${title} ainda em construção`}>Em construção</button>
          </article>
        ))}
      </section>
    </main>
  );
}
