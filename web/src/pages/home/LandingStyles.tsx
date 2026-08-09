/* LandingStyles — shared visual primitives for the home page sections.
   Section components render their own layout; this file holds the
   container, type scale, and table/card primitives used by several
   sections. Kept inside the home page scope (no shared chrome edits). */

export function LandingStyles() {
  return (
    <style>{`
      .landing {
        display: block;
      }
      .landing__section {
        padding: var(--space-8) 0;
      }
      .landing__section + .landing__section {
        border-top: 1px solid var(--color-border);
      }
      @media (min-width: 640px) {
        .landing__section { padding: var(--space-10) 0; }
      }
      @media (min-width: 1024px) {
        .landing__section { padding: var(--space-12) 0; }
      }

      .landing__eyebrow {
        display: inline-block;
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-accent);
        font-weight: 600;
        margin-bottom: var(--space-3);
      }
      .landing__lede {
        color: var(--color-text-soft);
        max-width: 60ch;
        font-size: var(--text-lg);
      }

      .landing__two-col {
        display: grid;
        gap: var(--space-6);
        grid-template-columns: 1fr;
        align-items: start;
      }
      @media (min-width: 1024px) {
        .landing__two-col {
          grid-template-columns: 1fr 1fr;
          gap: var(--space-8);
        }
      }

      .landing__card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-5);
      }

      .landing__grid {
        display: grid;
        gap: var(--space-4);
        grid-template-columns: 1fr;
      }
      @media (min-width: 640px) {
        .landing__grid { grid-template-columns: 1fr 1fr; }
      }
      @media (min-width: 1024px) {
        .landing__grid { grid-template-columns: repeat(4, 1fr); }
      }

      .landing__table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--text-sm);
      }
      .landing__table th,
      .landing__table td {
        text-align: left;
        padding: var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--color-border);
        vertical-align: top;
      }
      .landing__table th {
        background: var(--color-bg-elevated);
        color: var(--color-text);
        font-weight: 600;
        font-size: var(--text-sm);
        letter-spacing: var(--tracking-tight);
      }
      .landing__table td {
        color: var(--color-text-soft);
      }
      .landing__table .landing__check {
        color: var(--color-success);
        font-weight: 700;
      }
      .landing__table .landing__cross {
        color: var(--color-danger);
        font-weight: 700;
      }
      .landing__table .landing__partial {
        color: var(--color-text-muted);
        font-weight: 600;
      }

      .landing__code {
        background: var(--color-bg-elevated);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--space-4);
        overflow-x: auto;
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-text);
        margin: 0;
      }
      .landing__code code {
        font-family: inherit;
        background: transparent;
        padding: 0;
      }

      .landing__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: var(--space-3);
      }
      .landing__list li {
        position: relative;
        padding-left: var(--space-6);
        color: var(--color-text-soft);
      }
      .landing__list li::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0.55em;
        width: 0.55rem;
        height: 0.55rem;
        background: var(--color-accent);
        border-radius: var(--radius-pill);
      }

      .landing__btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-5);
        border-radius: var(--radius-md);
        font-weight: 600;
        font-size: var(--text-sm);
        border: 1px solid transparent;
        transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
        cursor: pointer;
        text-decoration: none;
      }
      .landing__btn:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
      }
      .landing__btn--primary {
        background: var(--color-accent);
        color: var(--color-accent-contrast);
      }
      .landing__btn--primary:hover {
        background: var(--color-accent-strong);
        text-decoration: none;
      }
      .landing__btn--ghost {
        background: transparent;
        color: var(--color-text);
        border-color: var(--color-border);
      }
      .landing__btn--ghost:hover {
        border-color: var(--color-accent);
        text-decoration: none;
      }
    `}</style>
  );
}
