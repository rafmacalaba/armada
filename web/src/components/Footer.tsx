export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="footer__inner">
        <p className="footer__copy">
          &copy; {year} armada. MIT licensed.
        </p>
        <ul className="footer__links">
          <li>
            <a
              href="https://github.com/rafmacalaba/armada"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source
            </a>
          </li>
          <li>
            <a
              href="https://github.com/rafmacalaba/armada/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              Issues
            </a>
          </li>
        </ul>
      </div>
      <style>{`
        .footer {
          border-top: 1px solid var(--color-border);
          background: var(--color-bg-elevated);
          color: var(--color-text-muted);
        }
        .footer__inner {
          max-width: var(--content-width);
          margin: 0 auto;
          padding: var(--space-5) var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        @media (min-width: 640px) {
          .footer__inner {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            padding: var(--space-5) var(--space-6);
          }
        }
        .footer__copy {
          margin: 0;
          font-size: var(--text-sm);
        }
        .footer__links {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          gap: var(--space-4);
          font-size: var(--text-sm);
        }
        .footer__links a { color: var(--color-text-muted); }
        .footer__links a:hover { color: var(--color-text); }
      `}</style>
    </footer>
  );
}
