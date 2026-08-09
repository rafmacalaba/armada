const STEPS = [
  {
    n: 1,
    title: "Write the contract",
    body: "Drop a plain-text REQUIREMENTS.md in your repo: goal, scope, non-goals, phases, and success criteria. That file is the mission.",
  },
  {
    n: 2,
    title: "Approve the contract",
    body: "You — the Admiral — sign off. Scope and success criteria are now locked. Anything outside the contract is a new voyage.",
  },
  {
    n: 3,
    title: "Launch the voyage",
    body: "armada reads the contract and launches a voyage: foundations, build, review, ship. Independent phases run in parallel; shared writers serialize.",
  },
  {
    n: 4,
    title: "Dispatch the ships",
    body: "Galleon, Clipper, Corvette, Xebec, Frigate, Caravel, and Bark each pick up their lane. Evidence and phase gates decide what is done.",
  },
];

export function HowItWorks() {
  return (
    <section
      className="landing__section"
      id="how-it-works"
      aria-labelledby="how-title"
    >
      <span className="landing__eyebrow">How it works</span>
      <h2 id="how-title">Four steps from contract to ship</h2>
      <ol className="landing__steps">
        {STEPS.map((step) => (
          <li key={step.n} className="landing__step">
            <div className="landing__step-num" aria-hidden="true">
              {step.n}
            </div>
            <div>
              <h3 className="landing__step-title">{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <style>{`
        .landing__steps {
          list-style: none;
          margin: var(--space-6) 0 0;
          padding: 0;
          display: grid;
          gap: var(--space-5);
          counter-reset: step;
        }
        @media (min-width: 1024px) {
          .landing__steps {
            grid-template-columns: 1fr 1fr;
          }
        }
        .landing__step {
          display: grid;
          grid-template-columns: 2.5rem 1fr;
          gap: var(--space-4);
          align-items: start;
        }
        .landing__step-num {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: var(--radius-pill);
          background: var(--color-accent);
          color: var(--color-accent-contrast);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: var(--text-sm);
        }
        .landing__step-title {
          font-size: var(--text-lg);
          margin-bottom: var(--space-2);
        }
      `}</style>
    </section>
  );
}
