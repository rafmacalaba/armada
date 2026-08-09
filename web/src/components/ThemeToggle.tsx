import type { ReactNode } from "react";
import { useTheme } from "../hooks/useTheme";

type ThemeToggleProps = {
  label?: ReactNode;
};

export function ThemeToggle({ label }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const nextLabel = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextLabel} theme`}
      aria-pressed={!isDark}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
      {label !== undefined ? (
        <span className="theme-toggle__label">{label}</span>
      ) : (
        <span className="theme-toggle__label visually-hidden">
          {nextLabel}
        </span>
      )}
      <style>{`
        .theme-toggle {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--color-bg-elevated);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-pill);
          font-size: var(--text-sm);
          transition: background 120ms ease, border-color 120ms ease;
        }
        .theme-toggle:hover {
          border-color: var(--color-accent);
        }
        .theme-toggle__icon {
          display: inline-flex;
          width: 1.1rem;
          height: 1.1rem;
        }
        .visually-hidden {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          padding: 0;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
