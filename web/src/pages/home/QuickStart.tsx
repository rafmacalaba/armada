// Package name below is a placeholder; the real install command will
// be confirmed against the upstream @armada/cli release. See CONTRACT.md
// for the install contract.

const COMMANDS = [
  {
    label: "Install the CLI",
    code: "npm i armada-cli",
    note: "Package name is a placeholder; real install command to be confirmed.",
  },
  {
    label: "Initialize a project",
    code: "armada init",
    note: "Writes REQUIREMENTS.md scaffold and ledger directories into your repo.",
  },
  {
    label: "Start a voyage",
    code: "armada voyage",
    note: "The Commodore reads the contract and dispatches the fleet.",
  },
];

export function QuickStart() {
  return (
    <section
      className="landing__section"
      id="quick-start"
      aria-labelledby="quick-start-title"
    >
      <span className="landing__eyebrow">Quick start</span>
      <h2 id="quick-start-title">Three commands to set sail</h2>
      <p className="landing__lede">
        Install, initialize, voyage. The first run writes your contract scaffold
        and ledger directories. The second dispatches the fleet.
      </p>
      <ol className="landing__quick">
        {COMMANDS.map((c) => (
          <li key={c.code} className="landing__quick-item">
            <div className="landing__quick-label">{c.label}</div>
            <pre className="landing__code">
              <code>{c.code}</code>
            </pre>
            <div className="landing__quick-note muted">{c.note}</div>
          </li>
        ))}
      </ol>
      <style>{`
        .landing__quick {
          list-style: none;
          margin: var(--space-6) 0 0;
          padding: 0;
          display: grid;
          gap: var(--space-5);
        }
        @media (min-width: 1024px) {
          .landing__quick {
            grid-template-columns: 1fr 1fr 1fr;
          }
        }
        .landing__quick-label {
          font-size: var(--text-sm);
          font-weight: 600;
          color: var(--color-text);
          margin-bottom: var(--space-2);
        }
        .landing__quick-note {
          font-size: var(--text-xs);
          margin-top: var(--space-2);
        }
      `}</style>
    </section>
  );
}
