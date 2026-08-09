type Cell = "yes" | "no" | "partial";

type Row = {
  feature: string;
  raw: Cell;
  hand: Cell;
  armada: Cell;
};

const ROWS: Row[] = [
  { feature: "Contract-first", raw: "no", hand: "partial", armada: "yes" },
  { feature: "Multi-agent", raw: "partial", hand: "no", armada: "yes" },
  { feature: "Phase gates", raw: "no", hand: "no", armada: "yes" },
  { feature: "Evidence-driven", raw: "no", hand: "no", armada: "yes" },
  { feature: "Parallel dispatch", raw: "no", hand: "no", armada: "yes" },
];

function Mark({ cell }: { cell: Cell }) {
  if (cell === "yes") {
    return <span className="landing__check" aria-label="Supported">Yes</span>;
  }
  if (cell === "partial") {
    return <span className="landing__partial" aria-label="Partial">Partial</span>;
  }
  return <span className="landing__cross" aria-label="Not supported">No</span>;
}

export function WhatMakesItDifferent() {
  return (
    <section
      className="landing__section"
      id="different"
      aria-labelledby="different-title"
    >
      <span className="landing__eyebrow">What makes it different</span>
      <h2 id="different-title">Compared to the alternatives</h2>
      <p className="landing__lede">
        Raw opencode gives you the runtime. A hand-written AGENTS.md gives you
        a prompt. armada gives you a contract, a roster, gates, and receipts.
      </p>
      <div className="landing__table-wrap">
        <table className="landing__table" aria-label="Comparison of approaches">
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col">Raw opencode</th>
              <th scope="col">Hand-written AGENTS.md</th>
              <th scope="col">armada</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.feature}>
                <th scope="row">{row.feature}</th>
                <td>
                  <Mark cell={row.raw} />
                </td>
                <td>
                  <Mark cell={row.hand} />
                </td>
                <td>
                  <Mark cell={row.armada} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`
        .landing__table-wrap {
          margin-top: var(--space-6);
          overflow-x: auto;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-bg-elevated);
        }
        .landing__table-wrap .landing__table {
          min-width: 640px;
        }
      `}</style>
    </section>
  );
}
