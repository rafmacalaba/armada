export function Hero() {
  return (
    <section className="landing__section landing__hero" aria-labelledby="hero-title">
      <span className="landing__eyebrow">armada</span>
      <h1 id="hero-title" className="landing__hero-title">
        Multi-agent software voyages
      </h1>
      <p className="landing__lede">
        Turn a written contract into a coordinated fleet of AI agents that
        build, test, review, and ship your software, in parallel, behind phase
        gates, with evidence at every step.
      </p>
      <div className="landing__hero-ctas">
        <a className="landing__btn landing__btn--primary" href="#quick-start">
          Get started
        </a>
        <a
          className="landing__btn landing__btn--ghost"
          href="https://github.com/rafmacalaba/armada"
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub
        </a>
      </div>
      <style>{`
        .landing__hero-title {
          font-size: clamp(2.2rem, 4.5vw, 3.4rem);
          max-width: 18ch;
          margin-bottom: var(--space-4);
        }
        .landing__hero-ctas {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-3);
          margin-top: var(--space-6);
        }
      `}</style>
    </section>
  );
}
