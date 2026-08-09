// These items are forward-looking and mirror the upstream armada
// TODO.md highlights. They will be revised as the upstream roadmap
// evolves; treat the exact wording as provisional.

const ITEMS = [
  "Plugin ecosystem for additional harnesses and code hosts",
  "Multi-language contracts and per-voyage language hints",
  "Token and cost budgets per voyage, surfaced in receipts",
  "Local LLM support for sensitive workloads and offline runs",
  "Public voyage telemetry: anonymous phase timing and pass rates",
  "A web console for live voyage inspection and rollback",
];

export function RoadmapHighlights() {
  return (
    <section
      className="landing__section"
      id="roadmap"
      aria-labelledby="roadmap-title"
    >
      <span className="landing__eyebrow">Roadmap</span>
      <h2 id="roadmap-title">Where the fleet is heading</h2>
      <p className="landing__lede">
        The current voyage is the contract, the roster, the gates, and the
        receipts. Forward-looking items below are provisional and will be
        revised against the upstream roadmap.
      </p>
      <ul className="landing__list landing__roadmap">
        {ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="muted landing__roadmap-note">
        Forward-looking. Exact wording subject to change as upstream lands.
      </p>
      <style>{`
        .landing__roadmap {
          margin-top: var(--space-5);
        }
        .landing__roadmap-note {
          margin-top: var(--space-4);
          font-size: var(--text-xs);
        }
      `}</style>
    </section>
  );
}
