import { NavLink, Link } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

export function TopNav() {
  return (
    <header className="topnav">
      <div className="topnav__inner">
        <Link to="/" className="topnav__brand" aria-label="armada home">
          <span className="topnav__mark" aria-hidden="true">
            <svg
              viewBox="0 0 32 32"
              width="28"
              height="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 12 A7 7 0 1 0 22 24" />
              <path d="M22 8 V26" />
              <path d="M22 9 L16 14 H22" />
              <path d="M5 28 Q9 26 13 28 T21 28" />
            </svg>
          </span>
          <span className="topnav__name">armada</span>
        </Link>

        <nav aria-label="Primary" className="topnav__nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? "topnav__link topnav__link--active" : "topnav__link"
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/docs"
            className={({ isActive }) =>
              isActive ? "topnav__link topnav__link--active" : "topnav__link"
            }
          >
            Docs
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              isActive ? "topnav__link topnav__link--active" : "topnav__link"
            }
          >
            About
          </NavLink>
        </nav>

        <div className="topnav__actions">
          <ThemeToggle />
        </div>
      </div>

      <style>{`
        .topnav {
          position: sticky;
          top: 0;
          z-index: 10;
          background: color-mix(in srgb, var(--color-bg) 85%, transparent);
          border-bottom: 1px solid var(--color-border);
          backdrop-filter: saturate(140%) blur(8px);
          -webkit-backdrop-filter: saturate(140%) blur(8px);
        }
        .topnav__inner {
          max-width: var(--content-width);
          margin: 0 auto;
          height: var(--topnav-height);
          padding: 0 var(--space-5);
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }
        @media (min-width: 640px) {
          .topnav__inner { padding: 0 var(--space-6); }
        }
        .topnav__brand {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--color-text);
          font-weight: 600;
          letter-spacing: var(--tracking-tight);
        }
        .topnav__brand:hover { text-decoration: none; }
        .topnav__mark {
          color: var(--color-accent);
          display: inline-flex;
        }
        .topnav__name { font-size: var(--text-lg); }

        .topnav__nav {
          display: flex;
          gap: var(--space-3);
          margin-left: var(--space-4);
        }
        .topnav__link {
          color: var(--color-text-muted);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
        }
        .topnav__link:hover {
          color: var(--color-text);
          text-decoration: none;
        }
        .topnav__link--active {
          color: var(--color-text);
          background: var(--color-surface);
        }
        .topnav__actions {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
        }

        @media (max-width: 639px) {
          .topnav__inner { gap: var(--space-2); }
          .topnav__nav { gap: var(--space-1); margin-left: 0; }
          .topnav__name { display: none; }
        }
      `}</style>
    </header>
  );
}
