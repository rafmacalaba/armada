<p align="center">
  <img src="./docs/logo.png" alt="armada" width="400" />
</p>

<h1 align="center">armada</h1>

<p align="center">
  <strong>Turn any repository into a self-organizing AI engineering team for opencode.<br/>
  One command. 8 specialists. Evidence-gated delivery.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rafamacalaba/armada"><img src="https://img.shields.io/npm/v/%40rafamacalaba%2Farmada" alt="npm version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node.js >= 20" /></a>
  <a href="https://github.com/rafmacalaba/armada/actions"><img src="https://github.com/rafmacalaba/armada/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

---

## The problem

**Solo AI coding agents are reckless.** Left unguided, a single agent will guess requirements instead of asking, skip test verification, clobber your working tree with half-baked code, and lose all progress when a session crashes or times out. You get code, sure - but no proof it works, no separation between builder and reviewer, and a mess on your main branch.

## What armada does

armada turns your repository into a **self-organizing AI engineering fleet**. Instead of a solo agent guessing across your codebase, armada scaffolds 8 specialist agents governed by SDK-enforced boundaries, evidence-gated phase criteria, restart-proof state, and isolated Git worktrees (`sandbox/<name>`).

**Today it works with [opencode](https://opencode.ai).** Support for Claude Code and Codex is on the roadmap. The architecture is harness-agnostic, so extending to other AI coding tools is a matter of renderers, not a rewrite.

**The key idea:** As **Admiral** [user], you command one contact: the **Commodore** [orchestrator]. You co-write a contract with the Commodore (or delegate contract drafting directly to it from a PRD), the Commodore dispatches specialists in parallel across clean worktree docks, QA audits evidence, and completed work lands cleanly as a reviewed Pull Request (`gh pr create`).

## Requirements

- [opencode](https://opencode.ai) installed and authenticated
- Node.js >= 20

---

## Quick start

### Install globally

The npm package is scoped, but its executable is still `armada`:

```bash
npm install -g @rafamacalaba/armada
armada --version
armada doctor
```

### Create a new project

```bash
armada new my-app
cd my-app
opencode
```

`armada new` asks which starter to use, creates the project, and runs `armada init` for you.
Use `--blank`, `--config ./vars.json`, or `--yes` for non-interactive setup.

### Initialize an existing repository

```bash
cd your-repo
armada init
opencode
```

armada detects the stack and scaffolds the fleet around your existing code. Use
`armada init --yes --yolo` for autonomous setup without permission prompts.

### Run without installing

```bash
npx @rafamacalaba/armada@latest new my-app
npx @rafamacalaba/armada@latest init
```

### Isolate feature work

```bash
armada feature new my-feature --worktree
armada voyage sandbox/my-feature
```

---

## How it works

<p align="center">
  <img src="./docs/workflow.png" alt="armada workflow mechanism diagram" width="640" />
</p>

```
       ADMIRAL [You]                 THE FLEET
    [one human user,            [8 agents, one boss]
    one conversation]
         |                               ^
         |  "ship the /about page"       |  phases, evidence, results
         v                               |
    +-------------------+          +-------------------------------------+
    |    COMMODORE      |--------->| backend-dev   frontend-dev   qa     |
    |  [orchestrator,   | delegate | adversary    security       docs   |
    |   only contact]   |--------->| architect                         |
    +-------------------+          +-------------------------------------+
         |                               |
         |  contract + state             |  disjoint files / worktrees
         v                               v
    +-------------------------------------------------------------------+
    |  WORKTREE  [sandbox/<feature>, AGENTS.md, REQUIREMENTS.md, state] |
    +-------------------------------------------------------------------+
```

**The workflow:**

1. **Co-write the contract - or delegate to the Commodore.** Describe your goal in plain language, drop in a raw wish, or paste a full PRD. The Commodore interviews you (or drafts the contract autonomously if delegated), breaking down your goal into phases with measurable success criteria (`armada/REQUIREMENTS.md`). No code is written against an unapproved contract.

2. **Parallel execution in isolated worktrees.** Once approved, the Commodore dispatches ready phases in parallel to specialist background subagents. Backend and frontend work concurrently on disjoint file slices inside an isolated Git worktree dock (`sandbox/<feature>`), keeping `main` pristine.

3. **Risk-gated evidence.** Specialists do not self-certify. QA participates in every phase; low-risk work gets focused smoke and acceptance checks, while medium/high-risk work gets deeper affected or full relevant evidence. Security and adversary reviews activate when the changed surface requires them.

4. **PR-first finish.** When all phase criteria pass, the Commodore opens a reviewed Pull Request (`gh pr create`) from the feature branch. Your main branch stays untouched until you review and merge.

5. **Restart-proof state engine.** Every transition is persisted to disk (`armada/state/active.json`). If a session crashes, times out, or closes, running `armada resume` or reopening opencode picks up where it left off.

---

## What makes it different

| | Raw opencode | Hand-written AGENTS.md | **armada** |
|---|:---:|:---:|:---:|
| Multi-agent orchestration | Manual | Manual | **Automated** |
| Main branch protection | None (clobbers tree) | Manual | **Isolated Git worktrees** (`sandbox/<name>`) |
| Parallel feature runs | Impossible | Cluttered conflicts | **Multiple concurrent worktrees** |
| Evidence gating | None | Aspirational (prompt-based) | **Enforced** (test runs, screenshots) |
| Role boundaries | None | Prompt-based | **SDK-enforced** (permissions in frontmatter) |
| Live session steering | None | None | **Attachable Tmux sessions** (`armada voyage` / `tmux attach`) |
| Delivery flow | Direct pushes | Uncontrolled | **PR-first** (`gh pr create`) |
| Restart-proof state | None | None | **Built-in** (survives crashes) |
| Defect lifecycle | None | None | **Structured ledger** (only QA closes) |
| Reproducible | N/A | Copy-paste | **Manifest** (`armada.yaml` -> identical team) |
| Setup time | N/A | Hours | **One command** |

---

## Meet the Fleet

8 AI specialists under your command, each governed by SDK-enforced permissions - not prompt politeness.

* **Admiral [You]** - The high commander. Directs the fleet, approves contracts, reviews evidence, and merges PRs.
* **Commodore [orchestrator]** - Delivery lead and scheduler. Co-writes contracts, dispatches specialists, and gates evidence. *Cannot edit source code.*
* **Galleon [backend-dev]** - Heavy backend engineer. Builds server logic, APIs, databases, and backend unit tests.
* **Clipper [frontend-dev]** - Fast UI/UX developer. Builds components, styling, responsive pages, and client tests.
* **Corvette [qa]** - Quality assurance officer. Writes E2E tests, captures screenshots, and owns `DEFECTS.md`. *The only role that can close a defect.*
* **Xebec [adversary]** - Hostile reviewer. Performs hostile passes on finished phases, hunting for edge cases, security vulnerabilities, and UI flaws. *Writes only adversarial findings and screenshots.*
* **Frigate [security]** - Security auditor. Audits auth, permissions, data leaks, and dependency vulnerabilities. *Writes only security findings and screenshots.*
* **Caravel [docs]** - Technical scribe. Maintains READMEs, API docs, changelogs, and user manuals.
* **Bark [architect]** - Naval architect and reviewer. Analyzes code structure, refactoring risks, and pattern compliance. *Read-only.*

### Role permissions matrix

| Role key | Title / Display name | Role | Can write code? | Permission boundaries |
|---|---|---|:---:|---|
| `user` | **Admiral [You]** | High Commander | N/A | Full control |
| `orchestrator` | **Commodore** [orchestrator] | Delivery Lead | No | No source edits; scoped Markdown notes |
| `backend-dev` | **Galleon** [backend-dev] | Backend Dev | Yes | Server and database files |
| `frontend-dev` | **Clipper** [frontend-dev] | Frontend Dev | Yes | Client and UI files |
| `qa` | **Corvette** [qa] | Quality Assurance | Tests only | `armada/e2e/`, `armada/ledgers/`, `armada/screenshots/` |
| `adversary` | **Xebec** [adversary] | Hostile Auditor | No | `armada/ledgers/*/ADVERSARIAL_REVIEW.md`, screenshots |
| `security` | **Frigate** [security] | Security Audit | No | `armada/ledgers/*/SECURITY_FINDINGS.md`, screenshots |
| `docs` | **Caravel** [docs] | Documentation | Docs only | Markdown and doc files |
| `architect` | **Bark** [architect] | Code Review | Read-only | `edit: { "*": "deny" }` |

The Commodore cannot edit source code. Security and adversary are limited to their own review
ledgers and screenshots; architect cannot write files. These are facts of the configuration, not
suggestions in a prompt.

---

## Key features

### Git worktree isolation and pristine main

Each feature voyage runs inside its own Git worktree (`sandbox/<name>`) on an isolated branch. Run multiple feature voyages in parallel without cross-feature collisions or half-finished code on `main`.

### Live Tmux steering and fleet observability

Feature voyages execute in background tmux sessions. Attach to any live voyage (`armada voyage sandbox/<name>` or `tmux attach`) to watch the Commodore, answer clarifying questions, or steer implementation. Use `armada fleet` for a cross-repo dashboard of active docks.

### PR-first delivery

A voyage is done only when it opens a reviewed Pull Request (`gh pr create`). No direct pushes to main and no unreviewed local merges. The fleet presents evidence, QA verifies, and the Admiral approves.

### Evidence-gated phases

Every phase has success criteria. A phase passes only when those criteria are demonstrated by a passing test run or a screenshot. No "trust me, it works."

### Adaptive gates and parallel fleet

The Commodore infers risk from changed files, public behavior, trust boundaries, inputs, side effects, blast radius, and reversibility. Risk controls staffing and evidence depth:

| Risk | Active baseline | Evidence |
|---|---|---|
| Low | Implementer + QA | Focused smoke + acceptance check |
| Medium | Implementer + QA | Affected tests + integration smoke; conditional specialist review |
| High | Implementer + QA + security + adversary | Full relevant suite + negative paths + independent review |

QA is always active. Other generated roles stay on standby until risk or changed surface requires them. Independent voyages use separate worktrees and can run concurrently. Within one voyage, phases whose dependencies have passed start immediately; only shared-file writers serialize.

### SDK-enforced role boundaries

Boundaries are enforced by SDK permissions in agent frontmatter. The Commodore cannot edit source
code, and each review role can write only its assigned evidence artifacts.

### Contract-first development

The Commodore co-writes a requirements contract with you before writing code. Phases, success criteria, and dependencies are agreed before the first line ships. Think of it as TDD for the entire feature.

### Restart-proof state

`armada/state/active.json` captures the active feature, phase graph, evidence, and next action. Kill the session, reopen it, and `armada resume` picks up where it left off.

### Self-improving

armada uses itself. The fleet built armada's own session-based state system autonomously, surfaced a real permission deadlock, and self-corrected test failures it introduced while writing its own code.

---

## Harness engineering

[Harness engineering](https://openai.com/index/harness-engineering/) means engineering the environment around the agent instead of relying on a smarter prompt. armada applies that principle when `armada init` generates a repository-owned harness:

- Native opencode agent definitions in `.opencode/agent/`
- `AGENTS.md` playbook with role rules, phase gates, and defect lifecycle
- `armada/REQUIREMENTS.md` contract with phases and measurable success criteria
- SDK-enforced permissions that bound which files each role can change
- Persisted state in `armada/state/` for crash recovery
- Isolated Git worktrees in `sandbox/<feature>` for safe parallel work

The environment makes correct behavior legible and enforceable. The Commodore delegates because its permissions require it, not because a prompt asks politely.

## Loop engineering

[Loop engineering](https://github.com/cobusgreyling/loop-engineering) means designing a control loop that prompts and verifies agents instead of prompting them one-off. armada's loop is:

```
contract -> dispatch ready phases in parallel -> collect evidence
         -> gate success criteria -> review and defect triage
         -> repeat -> QA end-to-end -> PR created
```

The loop separates makers from checkers: developers implement, QA and adversary review, and only evidence advances a phase. Every transition is persisted, so the loop resumes after a crash. The Admiral supplies judgment at the contract and merge gates; agents execute bounded work inside the harness.

See [Why armada?](./docs/WHY.md) for the full rationale and evidence.

---

## What armada is NOT

- **Not a plugin by default.** armada writes files; opencode runs them. Optional supervision plugins can be generated when requested; no runtime daemon is required.
- **Not an orchestration engine.** opencode is the runtime; armada emits the team and playbook.
- **Not a runtime dependency.** Run `armada init` once; the repository owns the generated team.
- **Not Claude Code or Codex today.** opencode is the current runtime. Claude Code and Codex support are roadmap work through future harness renderers.

---

## Commands

| Command | What it does |
|---|---|
| `armada init` | Scaffold the team into an existing repo |
| `armada new <name>` | Create a project from a questionnaire or first-party template |
| `armada doctor` | Environment health check |
| `armada status` | Show active feature, phase, and next action |
| `armada fleet` | Cross-repo per-lane progress dashboard |
| `armada fleet discover [--json] [--register] [--repo <path>]` | List or register untracked voyage worktrees |
| `armada voyage <lane>` | Boot a lane session for feature work |
| `armada feature <new\|list\|close>` | Manage feature contracts |
| `armada models [budget]` | Show curated model catalog |
| `armada resume` | Resume after an interrupted session |
| `armada uninstall` | Remove armada-generated artifacts |
| `armada help` | Show usage and version |

Four slash commands run inside the opencode TUI: `/armada`, `/armada-scout`, `/armada-voyage`, and `/armada-resume`.

---

## armada new: first-party templates

`armada new <name>` without flags runs an interactive questionnaire: it asks which category to scaffold, then fills template variables. Six categories ship with armada:

| Category | Stack | When to use |
|---|---|---|
| `blank` | Empty | Clean slate - just the armada team |
| `web-app` | TypeScript + Vite + React | Browser app |
| `ml-training` | Python 3 | ML experiments and training scripts |
| `research-paper` | LaTeX | Academic writing and BibTeX |
| `api-service` | TypeScript + Express | HTTP service with health endpoint |
| `cli-tool` | TypeScript + commander | CLI binary with subcommands |

Pick a category non-interactively with `--blank` or `--config ./vars.json`.

> **`armada new` already runs `armada init`.** After `armada new` completes, the armada team is already in the project. Use `armada init` only for in-place setup of existing repos.

### Advanced: external templates

Power users can point `armada new` at any cookiecutter-compatible template:

```bash
armada new my-app --template https://github.com/cookiecutter/cookiecutter-django
armada new my-app --template https://github.com/your-org/your-template
armada new my-app --template ./my-local-template
armada new my-app --template <url> --config ./vars.json
```

Templates may use `{{ cookiecutter.varname }}` placeholders. Variables are resolved from
`--config <file.json>`, `COOKIECUTTER_*` environment variables, or interactive prompts. Git URL
templates are fetched via `git clone --depth 1`.

### armada new: flags

| Flag | Effect |
|---|---|
| `--blank` | Skip questionnaire, use the blank template |
| `--template <url\|path>` | Use an external template |
| `--config <file.json>` | Load variables from JSON |
| `--yes` | Use defaults and skip prompts |

---

## What you get

```
your-repo/
+-- opencode.json                     # model + default_agent (never clobbers existing)
+-- AGENTS.md                         # playbook: team roles, defect ledger, phase gates
+-- armada/
|   +-- armada.yaml                   # manifest: source of truth, re-runnable
|   +-- REQUIREMENTS.md               # contract: phases + success criteria
|   +-- state/                        # loop memory: restart-proof
|   +-- ledgers/<feature>/            # DEFECTS.md, ADVERSARIAL_REVIEW.md, SECURITY_FINDINGS.md
|   +-- e2e/<feature>/                # per-feature E2E evidence (QA-owned)
|   +-- screenshots/<feature>/        # per-feature evidence (QA-owned)
+-- .opencode/
    +-- agent/                        # 8 native agents with permissions
    +-- commands/                     # slash commands
```

`armada init` never clobbers existing `opencode.json` or `AGENTS.md`. It always rewrites the
`armada/armada.yaml` and `.opencode/` artifacts it owns. Re-scaffold from the manifest at any time:

```bash
armada init --from-armada armada/armada.yaml --restart
```

The manifest produces the identical team on any machine, every time.

---

## Upgrade

Update a global installation with the latest published package:

```bash
npm install -g @rafamacalaba/armada@latest
armada --version
armada doctor
```

For a one-off latest run without changing your global installation:

```bash
npx @rafamacalaba/armada@latest <command>
```

After upgrading, re-scaffold initialized repositories from their manifest:

```bash
cd your-repo
armada init --from-armada armada/armada.yaml --restart
```

See the [operator guide](./docs/operator-guide.md) for rollback, uninstall, and upgrade details.

---

## Documentation

| Guide | Covers |
|---|---|
| [Getting started](./docs/getting-started.md) | Detailed setup, first feature, worktrees, and observability |
| [Operator guide](./docs/operator-guide.md) | Full CLI reference, upgrades, rollback, and uninstall |
| [User guide](./docs/user-guide.md) | Fleet concepts, roles, and day-to-day usage |
| [Architecture](./ARCHITECTURE.md) | Generator, manifest, agents, and data flow |
| [Why armada?](./docs/WHY.md) | Problem, design rationale, harness and loop engineering |
| [Auth and cost](./docs/auth-and-cost.md) | Providers, credentials, and model tiers |
| [Troubleshooting](./docs/troubleshooting.md) | Common setup and runtime failures |
| [Contributing](./CONTRIBUTING.md) | Development workflow and project conventions |
| [Support](./docs/support.md) | How to report issues and request help |

---

## Roadmap highlights

- **Multi-harness** - Claude Code and Codex renderers using the same team definition
- **Skills integration** - fleet-specific skills shipped into generated repositories
- **Dashboard TUI** - real-time `armada fleet --watch`
- **Role roster tuning** - right-sizing the 8-role team based on real sessions

Full roadmap in [TODO.md](./TODO.md).

---

## License

MIT. See [LICENSE](./LICENSE).
