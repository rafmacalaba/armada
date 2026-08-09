import { useEffect } from "react";

type Meta = { name?: string; property?: string; content: string };

const META_TAGS: Meta[] = [
  { name: "description", content: "Docs — curated guides for installing, operating, and contributing to armada." },
  { property: "og:title", content: "Docs — armada" },
  { property: "og:description", content: "A curated index of the armada docs: get started, operate it, contribute." },
  { property: "og:type", content: "website" },
  { property: "og:url", content: "https://rafmacalaba.github.io/armada/#/docs" },
];

function applyPageMeta(title: string, tags: Meta[]) {
  if (typeof document === "undefined") return;
  document.title = title;
  for (const t of tags) {
    const selector = t.name
      ? `meta[name="${t.name}"]`
      : `meta[property="${t.property}"]`;
    let el = document.head.querySelector<HTMLMetaElement>(selector);
    if (!el) {
      el = document.createElement("meta");
      if (t.name) el.setAttribute("name", t.name);
      if (t.property) el.setAttribute("property", t.property);
      document.head.appendChild(el);
    }
    el.setAttribute("content", t.content);
  }
}

type DocLink = {
  title: string;
  href: string;
  description: string;
};

const REPO = "https://github.com/rafmacalaba/armada/blob/master";

const GET_STARTED: DocLink[] = [
  {
    title: "Getting started",
    href: `${REPO}/docs/getting-started.md`,
    description:
      "Install armada, scaffold your first project, and ship a feature in a few minutes.",
  },
  {
    title: "User guide",
    href: `${REPO}/docs/user-guide.md`,
    description:
      "Day-to-day usage of the fleet: roles, contracts, worktrees, evidence gates.",
  },
];

const OPERATE_IT: DocLink[] = [
  {
    title: "Operator guide",
    href: `${REPO}/docs/operator-guide.md`,
    description: "CLI reference, upgrades, rollback, and uninstall.",
  },
  {
    title: "Troubleshooting",
    href: `${REPO}/docs/troubleshooting.md`,
    description: "Common setup and runtime failures with concrete fixes.",
  },
  {
    title: "Support",
    href: `${REPO}/docs/support.md`,
    description: "How to report issues and request help.",
  },
];

const CONTRIBUTE: DocLink[] = [
  {
    title: "Contributing guide",
    href: `${REPO}/CONTRIBUTING.md`,
    description:
      "Dev workflow and project conventions for the armada project.",
  },
];

const GROUPS: { id: string; title: string; blurb: string; links: DocLink[] }[] = [
  {
    id: "get-started",
    title: "Get started",
    blurb: "New to armada. Install it, ship a feature, and learn the loop.",
    links: GET_STARTED,
  },
  {
    id: "operate-it",
    title: "Operate it",
    blurb: "Already running. Maintain, upgrade, recover, and ask for help.",
    links: OPERATE_IT,
  },
  {
    id: "contribute",
    title: "Contribute",
    blurb: "Want to give back. Read the project conventions and open a PR.",
    links: CONTRIBUTE,
  },
];

export function Docs() {
  useEffect(() => {
    applyPageMeta("Docs — armada", META_TAGS);
  }, []);

  return (
    <article className="docs">
      <header className="docs__hero">
        <h1>Docs</h1>
        <p className="docs__lede">
          A curated index of the armada guides. Pick the group that matches
          where you are right now and open the file that answers the question
          you have. The pages live in the repo, so every link is a real
          markdown file you can read on GitHub.
        </p>
      </header>

      {GROUPS.map((group) => (
        <section
          key={group.id}
          id={group.id}
          className="docs__group"
          aria-labelledby={`${group.id}-h`}
        >
          <h2 id={`${group.id}-h`}>{group.title}</h2>
          <p className="docs__hint">{group.blurb}</p>
          <ul className="docs__list">
            {group.links.map((link) => (
              <li key={link.href}>
                <a
                  className="docs__card"
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="docs__card-title">{link.title}</span>
                  <span className="docs__card-desc">{link.description}</span>
                  <span className="docs__card-path" aria-hidden="true">
                    {link.href.replace(`${REPO}/`, "")}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <style>{`
        .docs {
          display: block;
          max-width: 72ch;
        }
        .docs__hero {
          margin-bottom: var(--space-10);
        }
        .docs__hero h1 {
          font-size: clamp(2rem, 4.5vw, 2.8rem);
          margin-bottom: var(--space-3);
        }
        .docs__lede {
          font-size: var(--text-lg);
          color: var(--color-text-soft);
          max-width: 60ch;
          margin: 0;
        }

        .docs__group {
          margin-bottom: var(--space-10);
          padding-top: var(--space-6);
          border-top: 1px solid var(--color-border);
        }
        .docs__group h2 {
          font-size: var(--text-2xl);
          margin-bottom: var(--space-2);
          letter-spacing: var(--tracking-tight);
        }
        .docs__hint {
          color: var(--color-text-muted);
          font-size: var(--text-sm);
          margin: 0 0 var(--space-4);
        }

        .docs__list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: var(--space-3);
        }
        .docs__card {
          display: grid;
          gap: var(--space-1);
          padding: var(--space-4);
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          color: var(--color-text);
          transition: border-color 120ms ease, transform 120ms ease;
        }
        .docs__card:hover,
        .docs__card:focus-visible {
          border-color: var(--color-accent);
          text-decoration: none;
          transform: translateY(-1px);
        }
        .docs__card-title {
          font-weight: 600;
          color: var(--color-link);
          font-size: var(--text-base);
        }
        .docs__card-desc {
          color: var(--color-text-soft);
          font-size: var(--text-sm);
          line-height: var(--leading-normal);
        }
        .docs__card-path {
          color: var(--color-text-muted);
          font-size: var(--text-xs);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          margin-top: var(--space-1);
        }

        @media (max-width: 639px) {
          .docs__group { margin-bottom: var(--space-8); }
          .docs__hero { margin-bottom: var(--space-8); }
        }
      `}</style>
    </article>
  );
}
