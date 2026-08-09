export function FinalCta() {
  return (
    <section
      className="landing__section landing__final"
      aria-labelledby="final-cta-title"
    >
      <div className="landing__final-inner">
        <h2 id="final-cta-title">Ready to set sail?</h2>
        <p className="landing__lede">
          Three commands. One contract. A fleet of ships. Start your first
          voyage today.
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
      </div>
      <style>{`
        .landing__final {
          border-top: 1px solid var(--color-border);
        }
        .landing__final-inner {
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-8);
          text-align: center;
        }
        .landing__final-inner .landing__hero-ctas {
          justify-content: center;
          margin-top: var(--space-5);
        }
      `}</style>
    </section>
  );
}
