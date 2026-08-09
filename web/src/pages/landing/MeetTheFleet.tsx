type Agent = { ship: string; role: string; oneLiner: string };

const FLEET: Agent[] = [
  { ship: "Admiral", role: "User", oneLiner: "Sets the mission; signs the contract" },
  {
    ship: "Commodore",
    role: "Orchestrator",
    oneLiner: "Coordinates the voyage; reads the contract, dispatches ships",
  },
  { ship: "Galleon", role: "Backend", oneLiner: "Implements server-side work" },
  { ship: "Clipper", role: "Frontend", oneLiner: "Builds the UI; the fast ship" },
  {
    ship: "Corvette",
    role: "Quality assurance",
    oneLiner: "Verifies acceptance criteria; owns the defect ledger",
  },
  {
    ship: "Xebec",
    role: "Adversarial reviewer",
    oneLiner: "Tries to break the work; files real findings",
  },
  {
    ship: "Frigate",
    role: "Security auditor",
    oneLiner: "Audits for vulnerabilities and secret leaks",
  },
  {
    ship: "Caravel",
    role: "Technical writer",
    oneLiner: "Writes docs, READMEs, and PR descriptions",
  },
  {
    ship: "Bark",
    role: "Architecture / code review",
    oneLiner: "Reviews architecture and the diff before merge",
  },
];

export function MeetTheFleet() {
  return (
    <section
      className="landing__section"
      id="fleet"
      aria-labelledby="fleet-title"
    >
      <span className="landing__eyebrow">Meet the fleet</span>
      <h2 id="fleet-title">Nine ships, one voyage</h2>
      <p className="landing__lede">
        armada's roster ships with the contract. Each role is scoped, has its
        own prompt, and only the work that needs it gets the work that has it.
      </p>
      <div className="landing__table-wrap">
        <table className="landing__table" aria-label="Armada fleet roster">
          <thead>
            <tr>
              <th scope="col">Ship</th>
              <th scope="col">Role</th>
              <th scope="col">What it does</th>
            </tr>
          </thead>
          <tbody>
            {FLEET.map((a) => (
              <tr key={a.ship}>
                <th scope="row">{a.ship}</th>
                <td>{a.role}</td>
                <td>{a.oneLiner}</td>
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
          min-width: 560px;
        }
        .landing__table-wrap .landing__table th,
        .landing__table-wrap .landing__table td {
          border-bottom: 1px solid var(--color-border);
        }
        .landing__table-wrap .landing__table tr:last-child th,
        .landing__table-wrap .landing__table tr:last-child td {
          border-bottom: none;
        }
      `}</style>
    </section>
  );
}
