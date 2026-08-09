<p align="center">
  <img src="./docs/logo.png" alt="armada" width="180" />
</p>

<h1 align="center">armada</h1>

<p align="center">
  <strong>A fleet of AI specialists — from a written contract to a merged Pull Request.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rafamacalaba/armada"><img src="https://img.shields.io/npm/v/%40rafamacalaba%2Farmada" alt="npm version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node.js >= 22" /></a>
  <a href="https://github.com/rafmacalaba/armada/actions"><img src="https://github.com/rafmacalaba/armada/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

---

## What it is

armada is a fleet of eight AI specialists that ships software like a voyage. The **contract** is at the bow — a written agreement of what gets built and how you know it works. The **loop** is the hull — dispatch, build, test, review, repeat. The **Pull Request** is the stern — the artifact the fleet hands back to you.

You don't write code with armada. You write the contract, the fleet runs the loop, and a reviewed PR lands in your repo. It runs on [opencode](https://opencode.ai) today and is designed to be harness-agnostic.

## How it works

<p align="center">
  <img src="./docs/workflow.png" alt="armada workflow" width="640" />
</p>

```
   contract  →  dispatch  →  build  →  test  →  review  →  PR
        ↑                                                       |
        └────── evidence gates every step ──────────────────────┘
```

A written contract becomes a sequence of evidence-gated phases. Each phase is handled by a specialist agent, each gate is enforced by tests and screenshots, and the loop runs until the work passes review. Nothing advances on "trust me" — only on evidence you can read.

[Why this works →](./docs/WHY.md)

## Install

```bash
npm install -g @rafamacalaba/armada
```

Requires Node.js 22+ and an authenticated [opencode](https://opencode.ai) install. Run `armada doctor` to confirm your environment is ready.

## Quick start

```bash
# New project — answers a short questionnaire, scaffolds the fleet, then opens opencode.
armada new my-app && cd my-app

# Existing repo — detects your stack and scaffolds the team in place.
cd your-repo && armada init

# One-off, no global install.
npx @rafamacalaba/armada@latest new my-app
```

After `armada new` or `armada init`, your repo owns a fleet. Open it in opencode and you're ready to ship.

## The contract: where you come in

Your only job is to write the **contract**. The code is the fleet's job.

The **Commodore** (the orchestrator agent) co-writes the contract with you: you describe the goal in plain language — a wish, a ticket, a PRD — and the Commodore interviews you for the missing details. Together you produce `armada/REQUIREMENTS.md` with phases, dependencies, and measurable success criteria. **No code is written against an unapproved contract.**

Once you sign off, the Commodore dispatches the fleet. Specialists work in isolated Git worktrees (separate copies of your repo, so the main branch stays clean), evidence flows back at every step, and the loop runs until a reviewed Pull Request opens. The Admiral (you) approves the contract and merges the PR. Everyone else is a ship.

## The fleet

| Ship | Role | What it does |
|---|---|---|
| **Admiral** (you) | High commander | Sets the mission, signs the contract, merges the PR |
| **Commodore** | Orchestrator | Co-writes the contract, dispatches specialists, gates evidence |
| **Galleon** | Backend | Server logic, APIs, databases, backend tests |
| **Clipper** | Frontend | UI, styling, responsive pages, client tests |
| **Corvette** | QA | E2E tests, screenshots, owns the defect ledger |
| **Xebec** | Adversary | Hostile review; hunts edge cases, vulns, UI flaws |
| **Frigate** | Security | Auth, permissions, data leaks, dependency review |
| **Caravel** | Docs | READMEs, API docs, changelogs, user manuals |
| **Bark** | Architect | Code review, refactoring risk, pattern compliance (read-only) |

Boundaries are enforced by SDK permissions, not prompt politeness. The Commodore cannot edit source code. Security, adversary, and architect can only write their own review artifacts. Full per-role detail in the [user guide](./docs/user-guide.md).

## What you get

```
your-repo/
├── opencode.json
├── AGENTS.md
├── armada/
│   ├── armada.yaml               # manifest: re-runnable source of truth
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

## Learn more

- **[Website tour](https://rafmacalaba.github.io/armada/)** — visual walkthrough of the loop, the fleet, and what each phase produces.
- **[Getting started](./docs/getting-started.md)** — your first feature, end to end.
- **[User guide](./docs/user-guide.md)** — fleet concepts, roles, day-to-day usage.
- **[Why armada?](./docs/WHY.md)** — the case for loop engineering over prompting.
- **[Operator guide](./docs/operator-guide.md)** — CLI reference, upgrades, rollback.

## License

MIT. See [LICENSE](./LICENSE).
