<p align="center">
  <img src="./docs/logo.png" alt="armada" width="180" />
</p>

<h1 align="center">armada</h1>

<p align="center">
  <strong>Self-organizing AI engineering fleet for opencode.<br/>
  Contract-first, evidence-gated, PR-first.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rafamacalaba/armada"><img src="https://img.shields.io/npm/v/%40rafamacalaba%2Farmada" alt="npm version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node.js >= 22" /></a>
  <a href="https://github.com/rafmacalaba/armada/actions"><img src="https://github.com/rafmacalaba/armada/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

---

## What it is

armada turns a written contract into a coordinated team of AI specialists that build, test, review, and ship your software in parallel — behind phase gates, with evidence at every step. It works with [opencode](https://opencode.ai) today and is designed to be harness-agnostic.

A **visual tour** lives at <https://rafmacalaba.github.io/armada/> — informational only, not where armada runs. armada is the npm package; the site is a curated, read-only companion to the docs in this repo.

## Install

```bash
npm install -g @rafamacalaba/armada
armada --version
armada doctor
```

Requires Node.js 22+ and an authenticated [opencode](https://opencode.ai) install. No daemon, no runtime dependency on armada after init.

## Quick start

```bash
# New project
armada new my-app && cd my-app && opencode

# Existing repo
cd your-repo && armada init && opencode

# One-off, no global install
npx @rafamacalaba/armada@latest new my-app
```

Once inside opencode, describe what you want. The **Commodore** (the orchestrator agent) co-writes a contract with you, dispatches the fleet, gates every phase on evidence, and opens a PR when the work passes review.

## How it works

<p align="center">
  <img src="./docs/workflow.png" alt="armada workflow" width="640" />
</p>

```
contract -> dispatch ready phases in parallel -> collect evidence
         -> gate success criteria -> review and defect triage
         -> repeat -> QA end-to-end -> PR created
```

The loop separates makers from checkers: specialists implement, QA and adversary review, and only evidence advances a phase. Every transition is persisted, so the loop resumes after a crash. See [Why armada?](./docs/WHY.md) for the full rationale.

## The fleet

| Ship | Role | What it does |
|---|---|---|
| **Admiral** (you) | High commander | Sets the mission, signs the contract, merges the PR |
| **Commodore** | Orchestrator | Dispatches specialists, gates evidence, never edits source |
| **Galleon** | Backend | Server logic, APIs, databases, backend tests |
| **Clipper** | Frontend | UI, styling, responsive pages, client tests |
| **Corvette** | QA | E2E tests, screenshots, owns the defect ledger (only role that can close a defect) |
| **Xebec** | Adversary | Hostile review; hunts edge cases, vulns, UI flaws |
| **Frigate** | Security | Auth, permissions, data leaks, dependency review |
| **Caravel** | Docs | READMEs, API docs, changelogs, user manuals |
| **Bark** | Architect | Code review, refactoring risk, pattern compliance (read-only) |

Boundaries are enforced by SDK permissions in agent frontmatter — not prompt politeness. The Commodore cannot edit source code. Security, adversary, and architect can only write their own review artifacts.

## Why not just opencode?

| | Raw opencode | Hand-written AGENTS.md | **armada** |
|---|:---:|:---:|:---:|
| Multi-agent orchestration | Manual | Manual | **Automated** |
| Main branch protection | Clobbers tree | Manual | **Isolated worktrees** (`sandbox/<name>`) |
| Parallel feature runs | Impossible | Cluttered | **Multiple concurrent worktrees** |
| Evidence gating | None | Aspirational | **Enforced** (tests, screenshots) |
| Role boundaries | None | Prompt-based | **SDK-enforced** (permissions) |
| Live session steering | None | None | **Attachable tmux sessions** |
| Delivery flow | Direct pushes | Uncontrolled | **PR-first** (`gh pr create`) |
| Restart-proof state | None | None | **Built-in** (`armada state`) |
| Defect lifecycle | None | None | **Structured ledger** |
| Setup time | — | Hours | **One command** |

## What you get

After `armada init`, your repo owns the team:

```
your-repo/
├── opencode.json
├── AGENTS.md
├── armada/
│   ├── armada.yaml               # manifest: source of truth, re-runnable
│   ├── REQUIREMENTS.md           # contract: phases + success criteria
│   ├── state/                    # restart-proof loop memory
│   ├── ledgers/<feature>/        # DEFECTS.md, ADVERSARIAL_REVIEW.md, SECURITY_FINDINGS.md
│   ├── e2e/<feature>/            # per-feature E2E evidence
│   └── screenshots/<feature>/    # per-feature evidence
└── .opencode/
    ├── agent/                    # 8 native agents with permissions
    └── commands/                 # slash commands
```

`armada init` never clobbers existing `opencode.json` or `AGENTS.md`. Re-scaffold any time from the manifest:

```bash
armada init --from-armada armada/armada.yaml --restart
```

## Commands

| Command | What it does |
|---|---|
| `armada init` | Scaffold the team into an existing repo |
| `armada new <name>` | Create a project from a template or questionnaire |
| `armada voyage <name>` | Create worktree + boot a lane for feature work |
| `armada voyage list` | List all features |
| `armada voyage close <name>` | Evidence-gated feature close |
| `armada fleet` | Cross-repo per-lane progress dashboard |
| `armada status` | Active feature, phase, and next action |
| `armada doctor` | Environment health check |
| `armada resume` | Resume after an interrupted session |
| `armada uninstall` | Remove armada-generated artifacts |

Four slash commands run inside the opencode TUI: `/armada`, `/armada-scout`, `/armada-voyage`, `/armada-resume`. Full reference in the [operator guide](./docs/operator-guide.md).

## Learn more

| Guide | Covers |
|---|---|
| [Getting started](./docs/getting-started.md) | First feature, worktrees, observability |
| [User guide](./docs/user-guide.md) | Fleet concepts, roles, day-to-day usage |
| [Operator guide](./docs/operator-guide.md) | CLI reference, upgrades, rollback, uninstall |
| [Why armada?](./docs/WHY.md) | Problem, design rationale, harness + loop engineering |
| [Architecture](./ARCHITECTURE.md) | Generator, manifest, agents, data flow |
| [Auth and cost](./docs/auth-and-cost.md) | Providers, credentials, model tiers |
| [Troubleshooting](./docs/troubleshooting.md) | Common setup and runtime failures |
| [Contributing](./CONTRIBUTING.md) | Development workflow and project conventions |
| [Support](./docs/support.md) | Issues and help |

## License

MIT. See [LICENSE](./LICENSE).
