type Feature = { title: string; body: string };

const FEATURES: Feature[] = [
  {
    title: "Contract-first",
    body: "Every voyage starts from a written REQUIREMENTS.md. Scope and success criteria are explicit and locked before any code is written.",
  },
  {
    title: "Adaptive team",
    body: "Commodore sizes the roster to the voyage: implementers, QA, security, adversary, and docs are dispatched only when the contract needs them.",
  },
  {
    title: "Parallel phases",
    body: "Independent phases run as background subagents. Shared writers serialize. The fleet keeps moving without stepping on each other.",
  },
  {
    title: "Evidence gates",
    body: "Each phase closes only when its success criteria are demonstrably true: a passing test, a screenshot, a signed receipt.",
  },
  {
    title: "Defect ledger",
    body: "Every finding is filed in armada/ledgers/{feature}/DEFECTS.md with steps, severity, and history. Nothing is closed by assertion — only by retest.",
  },
  {
    title: "Risk-tiered reviews",
    body: "Commodore infers risk; QA is always active; security, adversary, and architect depth follows the contract's risk profile.",
  },
  {
    title: "Voyage lanes",
    body: "Worktrees isolate parallel work. Each lane gets its own PR, its own evidence, and its own merge decision.",
  },
  {
    title: "PR-first finish",
    body: "A voyage is not done when a ship says so — it is done when a PR is opened, reviewed, and merged with receipts attached.",
  },
];

export function KeyFeatures() {
  return (
    <section
      className="landing__section"
      id="features"
      aria-labelledby="features-title"
    >
      <span className="landing__eyebrow">Key features</span>
      <h2 id="features-title">What you get out of the box</h2>
      <ul className="landing__grid landing__features">
        {FEATURES.map((f) => (
          <li key={f.title} className="landing__card landing__feature">
            <h3 className="landing__feature-title">{f.title}</h3>
            <p>{f.body}</p>
          </li>
        ))}
      </ul>
      <style>{`
        .landing__features {
          list-style: none;
          margin: var(--space-6) 0 0;
          padding: 0;
        }
        .landing__feature-title {
          font-size: var(--text-lg);
          margin-bottom: var(--space-2);
        }
      `}</style>
    </section>
  );
}
