export function ProblemAndPromise() {
  return (
    <section
      className="landing__section"
      id="problem"
      aria-labelledby="problem-title"
    >
      <div className="landing__two-col">
        <div className="landing__card">
          <span className="landing__eyebrow">The problem</span>
          <h2 id="problem-title">Multi-agent coding is harder than it looks</h2>
          <p>
            Naive setups hand a single prompt to a single model and call it
            done. Real software needs a contract, a plan, parallel workers,
            reviews, and a way to know when "done" is actually done. Without
            those, a multi-agent run is a coordination tax with no
            coordination benefit.
          </p>
        </div>
        <div className="landing__card">
          <span className="landing__eyebrow">What armada does</span>
          <h2>What armada does</h2>
          <p>
            armada is a fleet of specialized agents — backend, frontend, QA,
            security, docs — coordinated by an orchestrator. You write the
            contract. The Commodore reads it, dispatches the right ships, and
            keeps everyone behind phase gates until the voyage is done and the
            evidence is in.
          </p>
        </div>
      </div>
    </section>
  );
}
