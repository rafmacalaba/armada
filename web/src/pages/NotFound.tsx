import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <section className="notfound">
      <p className="notfound__code">404</p>
      <h1>Lost at sea</h1>
      <p>
        That page isn&rsquo;t on the chart. Head back to the{" "}
        <Link to="/">landing</Link> or the <Link to="/about">about</Link> page.
      </p>
      <style>{`
        .notfound { text-align: center; padding: var(--space-8) 0; }
        .notfound__code {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          letter-spacing: var(--tracking-wide);
          text-transform: uppercase;
          color: var(--color-text-muted);
          margin-bottom: var(--space-3);
        }
      `}</style>
    </section>
  );
}
