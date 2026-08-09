import { useEffect } from "react";

type Meta = { name?: string; property?: string; content: string };

const META_TAGS: Meta[] = [
  { name: "description", content: "About armada: the team, workflow, and engineering principles behind a fleet of AI agents that ships software together." },
  { property: "og:title", content: "About — armada" },
  { property: "og:description", content: "armada is a small fleet of cooperating agents that plan, build, review, and ship software. Learn what it is, what it isn't, and where it's going." },
  { property: "og:type", content: "website" },
  { property: "og:url", content: "https://rafmacalaba.github.io/armada/#/about" },
];

function applyPageMeta(title: string, tags: Meta[]) {
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

const FEATURE_HIGHLIGHTS = [
  "Contract-first planning — every voyage starts from a written REQUIREMENTS.md, not a chat thread.",
  "Adaptive team selection — risk decides who ships: implementer + QA by default, security and adversary standby for higher stakes.",
  "Phase-gated evidence — a phase only passes when its success criteria are demonstrated by a test run, a screenshot, or both.",
  "Parallel phase dispatch — independent phases run as background subagents; shared writers serialize to avoid race conditions.",
  "Defect ledger — every finding lives in a single file, owned by QA, with statuses that can only be set by their author.",
  "PR-first finish — every lane closes with a PR that links evidence, not a final commit on master.",
];

const NOT_LIST = [
  "Not a plugin. It is a workflow plus a scaffold of files you check in.",
  "Not an engine. It dispatches into opencode; opencode runs the model.",
  "Not a runtime dependency. Your shipped product has no awareness of armada.",
  "Not tied to Claude Code or Codex today. Armada is opencode-agnostic.",
  "Not a replacement for human review. It augments review with structured evidence.",
];

const ROADMAP = [
  "Pluggable harness adapters so the same workflow runs against other agent runtimes (forward-looking).",
  "First-class telemetry: per-phase cost, latency, and defect recurrence surfaced to the commodore (forward-looking).",
  "Voyage templates per stack (web, mobile, data) seeded from the contract (forward-looking).",
  "Public defect browser that mirrors armada/ledgers without leaking private repo contents (forward-looking).",
  "Contract linter that catches ambiguous success criteria before the team is dispatched (forward-looking).",
  "Long-term: a thin CLI so voyages can be replayed offline from a saved dispatch manifest (forward-looking).",
];

const CONTACT_LINKS = [
  { label: "GitHub issues", href: "https://github.com/rafmacalaba/armada/issues" },
  { label: "Contributing guide", href: "https://github.com/rafmacalaba/armada/blob/main/CONTRIBUTING.md" },
  { label: "License (MIT)", href: "https://github.com/rafmacalaba/armada/blob/main/LICENSE" },
];

export function About() {
  useEffect(() => {
    applyPageMeta("About — armada", META_TAGS);
  }, []);

  return (
    <article className="about">
      <header className="about__hero">
        <h1>About armada</h1>
        <p className="about__lede">
          The story behind a small fleet of agents that plan, build, review,
          and ship software together.
        </p>
      </header>

      <section id="mission" className="about__section" aria-labelledby="mission-h">
        <h2 id="mission-h">Mission</h2>
        <p>
          AI-assisted development works best when the human stops babysitting
          the model and starts running a team. Armada exists to make that
          transition durable: a contract becomes a voyage, a voyage becomes a
          sequence of evidence-gated phases, and every phase produces
          artifacts a human can read. The goal is not autonomy for its own
          sake — it is the boring, reproducible version of autonomy that
          still lets a human override any decision in five seconds.
        </p>
      </section>

      <section id="what-is" className="about__section" aria-labelledby="what-is-h">
        <h2 id="what-is-h">What armada is</h2>
        <p>
          Armada is a workflow and a file scaffold that you check into your
          repository. The workflow describes how a voyage moves from contract
          to merged PR; the scaffold carries the team, the ledgers, the
          skills, and the rules each voyage needs to run.
        </p>
        <ul className="about__list">
          {FEATURE_HIGHLIGHTS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section id="what-is-not" className="about__section" aria-labelledby="what-is-not-h">
        <h2 id="what-is-not-h">What armada is not</h2>
        <p className="about__hint">
          Knowing what a tool is helps less than knowing what it deliberately
          is not. The following are common misreadings:
        </p>
        <ul className="about__list about__list--warn">
          {NOT_LIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section id="opencode-role" className="about__section" aria-labelledby="opencode-role-h">
        <h2 id="opencode-role-h">Role in the opencode ecosystem</h2>
        <p>
          <a
            href="https://opencode.ai"
            target="_blank"
            rel="noopener noreferrer"
          >
            opencode
          </a>{" "}
          is the runtime. It owns the model, the tool calls, and the agent
          loop. Armada emits the team and the playbook that opencode
          orchestrates: agents, permissions, skills, contracts, ledgers. When
          an armada voyage runs, the commodore writes a dispatch manifest;
          opencode reads that manifest and drives the agents. Armada is the
          staff, not the ship.
        </p>
      </section>

      <section id="harness-engineering" className="about__section" aria-labelledby="harness-engineering-h">
        <h2 id="harness-engineering-h">Harness engineering</h2>
        <p>
          A harness is the bundle of permissions, agents, skills, plugins, and
          prompts that surrounds a model and turns it into a worker. Armada
          treats the harness as a first-class artifact: every ship in the
          fleet has a written role, a defined scope, a list of skills it may
          load, and a permissions file the human can audit at a glance.
          Editing a harness is part of the diff. A change to how a reviewer
          reads code is a change to a file, reviewed like any other change.
        </p>
      </section>

      <section id="loop-engineering" className="about__section" aria-labelledby="loop-engineering-h">
        <h2 id="loop-engineering-h">Loop engineering</h2>
        <p>
          The product is the loop. Every voyage follows the same durable
          cycle: <em>plan</em> &rarr; <em>dispatch</em> &rarr;{" "}
          <em>gate</em> &rarr; <em>evidence</em> &rarr; <em>next</em>.
          Each step has a written artifact, each artifact has an owner, and
          each owner has a role. The loop is designed to survive the model
          being swapped, the team being reshuffled, or the human leaving the
          keyboard for an hour. If a step cannot produce evidence, the loop
          does not advance.
        </p>
      </section>

      <section id="roadmap" className="about__section" aria-labelledby="roadmap-h">
        <h2 id="roadmap-h">Roadmap</h2>
        <p className="about__hint">
          The items below look forward. They are not commitments; they are
          the shape of the next voyages.
        </p>
        <ul className="about__list">
          {ROADMAP.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section id="contact" className="about__section" aria-labelledby="contact-h">
        <h2 id="contact-h">Contact</h2>
        <p>
          The fastest way to reach the team is to open an issue. Bug reports,
          contract disputes, and proposed loop changes all start the same way.
        </p>
        <ul className="about__links">
          {CONTACT_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section id="credits" className="about__section" aria-labelledby="credits-h">
        <h2 id="credits-h">Credits</h2>
        <p>
          Designed and built by <strong>Rafael Macalaba</strong>. Released
          under the{" "}
          <a
            href="https://github.com/rafmacalaba/armada/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
          >
            MIT license
          </a>
          . Thanks to everyone running voyages, filing defects, and pushing
          the loop forward.
        </p>
      </section>

      <style>{`
        .about {
          display: block;
          max-width: 72ch;
        }
        .about__hero {
          margin-bottom: var(--space-10);
        }
        .about__hero h1 {
          font-size: clamp(2rem, 4.5vw, 2.8rem);
          margin-bottom: var(--space-3);
        }
        .about__lede {
          font-size: var(--text-lg);
          color: var(--color-text-soft);
          max-width: 60ch;
          margin: 0;
        }

        .about__section {
          margin-bottom: var(--space-10);
          padding-top: var(--space-6);
          border-top: 1px solid var(--color-border);
        }
        .about__section:first-of-type {
          border-top: 0;
          padding-top: 0;
        }
        .about__section h2 {
          font-size: var(--text-2xl);
          margin-bottom: var(--space-3);
          letter-spacing: var(--tracking-tight);
        }
        .about__section p {
          max-width: 60ch;
        }

        .about__hint {
          color: var(--color-text-muted);
          font-size: var(--text-sm);
          margin-bottom: var(--space-3);
        }

        .about__list {
          list-style: none;
          padding: 0;
          margin: var(--space-3) 0 0;
          display: grid;
          gap: var(--space-3);
        }
        .about__list li {
          position: relative;
          padding: var(--space-3) var(--space-4) var(--space-3) var(--space-6);
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          color: var(--color-text-soft);
          line-height: var(--leading-normal);
        }
        .about__list li::before {
          content: "";
          position: absolute;
          left: var(--space-3);
          top: 1.1em;
          width: 0.4rem;
          height: 0.4rem;
          border-radius: 50%;
          background: var(--color-accent);
        }
        .about__list--warn li::before {
          background: var(--color-text-muted);
        }

        .about__links {
          list-style: none;
          padding: 0;
          margin: var(--space-3) 0 0;
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-3);
        }
        .about__links li {
          margin: 0;
        }
        .about__links a {
          display: inline-block;
          padding: var(--space-2) var(--space-3);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          color: var(--color-text);
          background: var(--color-bg-elevated);
          font-size: var(--text-sm);
        }
        .about__links a:hover,
        .about__links a:focus-visible {
          border-color: var(--color-accent);
          text-decoration: none;
        }

        @media (max-width: 639px) {
          .about__section { margin-bottom: var(--space-8); }
          .about__hero { margin-bottom: var(--space-8); }
        }
      `}</style>
    </article>
  );
}
