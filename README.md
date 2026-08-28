<p align="center">
  <img src="./docs/logo-v2.png" alt="armada" width="180" />
</p>

<h1 align="center">armada</h1>

<p align="center">
  <em>Loop engineering for software development.</em>
</p>

<p align="center">
  <strong>Turn any repository into a self-organizing AI engineering team.<br/>One command. 8 specialists. Evidence-gated delivery.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rafamacalaba/armada"><img src="https://img.shields.io/npm/v/%40rafamacalaba%2Farmada" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@rafamacalaba/armada"><img src="https://img.shields.io/npm/dm/%40rafamacalaba%2Farmada" alt="npm downloads" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node.js >= 22" /></a>
  <a href="https://github.com/rafmacalaba/armada/actions"><img src="https://github.com/rafmacalaba/armada/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

<p align="center">
  <a href="https://rafmacalaba.github.io/armada/">Website</a> &middot;
  <a href="./docs/getting-started.md">Getting Started</a> &middot;
  <a href="./docs/user-guide.md">User Guide</a> &middot;
  <a href="./docs/WHY.md">Why armada?</a>
</p>

---

## The problem with AI coding agents

AI coding agents are fast. They are also unsupervised, unverified, and amnesiac.

- **They guess when they should ask.** "Build the login page" becomes a framework choice, an auth strategy, and a color palette — all decided without you.
- **They skip verification.** The same agent that wrote the bug declares it fixed. There is no maker/checker split.
- **They forget everything.** Kill the terminal, lose the context. A 5-phase feature starts from scratch.
- **They have no boundaries.** A solo agent rewrites your CI config while fixing a CSS bug. Nothing stops it.
- **They clobber your working tree.** Direct edits on your active branch. Parallel tasks collide. Recovery is manual.

These are not model failures. They are **environment** failures. The fix is not a smarter model — it is a smarter harness and a tighter loop.

## The fix: loop engineering

[Loop engineering](https://github.com/cobusgreyling/loop-engineering) replaces one-shot prompting with **control loops that prompt agents for you**. You define the goal. The loop handles dispatch, verification, gating, and iteration — agents are components in the loop, not autonomous actors.

armada implements loop engineering as a concrete system. You write the **contract** (what to build and how to know it works), and the fleet runs the **loop** until a reviewed Pull Request lands in your repo.

<p align="center">
  <img src="./docs/workflow.png" alt="armada workflow" width="640" />
</p>

```
   contract  →  dispatch  →  build  →  test  →  review  →  PR
        ↑           |                                        |
        |      [phases with no          [defects loop back   |
        |       dependency run           to the developer]   |
        |       in parallel]                                 |
        └──────── evidence gates every transition ──────────┘
```

The loop has mechanical properties that make it reliable:

- **Maker/checker split.** Developers write code. QA and the adversary check it. A maker never passes its own work.
- **Parallel phases.** Independent phases dispatch simultaneously as background subagents with disjoint file scope. Only phases that depend on each other serialize.
- **Evidence, not reports.** Every gate requires proof you can read — a passing test run, a screenshot, a file:line citation. Nothing advances on "trust me."
- **Crash-proof state.** Every transition writes to disk. Kill the session, reopen, and the loop continues where it left off.

### Parallel feature work

armada isolates each feature in its own Git worktree (sandbox). Multiple features run simultaneously in the same repo without colliding — each with its own contract, state, and branch. One fleet, many voyages.

```bash
armada voyage auth-system              # boots a lane for feature "auth-system"
armada voyage dashboard                # boots another lane — runs in parallel
armada fleet                           # dashboard: one row per active lane
```

Features in separate worktrees cannot collide. `main` stays pristine. Every voyage ends in a PR, never a local merge.

[Why this works →](./docs/WHY.md)

## Quick start

```bash
# Install globally
npm install -g @rafamacalaba/armada

# Existing repo — detects your stack, scaffolds the team in place.
cd your-repo && armada init

# New project — questionnaire, scaffold, ready to ship.
armada new my-app && cd my-app

# Zero-install trial.
npx @rafamacalaba/armada@latest new my-app
```

Requires Node.js 22+ and an authenticated [opencode](https://opencode.ai) install. Run `armada doctor` to confirm your environment is ready.

### Pi integration

armada ships as a first-class [pi package](https://pi.dev/packages). Inside [pi](https://pi.dev) you get:

- **14 skills** (`armada-contract`, `armada-dispatch`, `armada-gate`, `armada-tdd`, ...), loaded on-demand by the agent or invoked via `/skill:armada-contract`
- **Prompt templates**: `/voyage <feature>`, `/contract`, `/fleet`, `/armada-status`
- **Tools & commands**: `armada_fleet` / `armada_status` tools, `/armada-fleet`, `/armada-status`, `/armada-doctor` commands, and a force-push guard
- **Fleet subagents**: the `armada_dispatch` tool runs the armada team (Galleon, Clipper, Corvette, ...) as isolated pi subagents — single or parallel — with armada's file-ownership boundaries enforced in each agent prompt

```bash
pi install npm:@rafamacalaba/armada
```

To run the full fleet inside pi, add `harnesses: ["opencode", "pi"]` (or just `["pi"]`) under `project:` in `armada.yaml` and re-run `armada init`. This scaffolds each role into `.pi/agents/<ship-name>.md` (frontmatter name/description/model, prompt body, edit boundaries). Model IDs: `openrouter/*` roles pin their model; `opencode-*` roles inherit the dispatching session's model.

### OpenRouter Provider Discounts

Save up to 20x on OpenRouter models by routing to discounted providers (Novita, StreamLake, Xiaomi):

```bash
# Check live OpenRouter provider prices and savings multipliers
armada models --discounts

# Init repo with a preferred discounted provider
armada init --openrouter-provider Novita
```

After `armada init`, open the repo in opencode. The fleet is loaded. Describe your goal in plain language — a wish, a ticket, a PRD — and the **Commodore** (orchestrator) interviews you for the missing details. Together you produce the contract (`armada/REQUIREMENTS.md`) with phases, dependencies, and measurable success criteria. Once you approve, the fleet runs the loop autonomously until a PR opens.

## The fleet

| Role | Codename | What it does |
|---|---|---|
| **You** | Admiral | Sets the mission, signs the contract, merges the PR |
| **Orchestrator** | Commodore | Co-writes the contract, dispatches specialists, gates evidence |
| **Backend** | Galleon | Server logic, APIs, databases, backend tests |
| **Frontend** | Clipper | UI, styling, responsive pages, client tests |
| **QA** | Corvette | E2E tests, screenshots, owns the defect ledger |
| **Adversary** | Xebec | Hostile review — hunts edge cases, vulns, UI flaws |
| **Security** | Frigate | Auth, permissions, data leaks, dependency audit |
| **Docs** | Caravel | READMEs, API docs, changelogs, user manuals |
| **Architect** | Bark | Code review, refactoring risk, pattern compliance (read-only) |

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
│   └── screenshots/<feature>/    # per-feature visual evidence
└── .opencode/
    ├── agent/                    # 8 native agents with SDK-enforced permissions
    └── commands/                 # slash commands (/voyage, /patrol, /fleet, /status)
```

`armada init` never clobbers existing `opencode.json` or `AGENTS.md`. Re-scaffold any time from the manifest:

```bash
armada init --from-armada armada/armada.yaml --restart
```

## Built with armada

armada uses itself. The fleet builds armada's own features through the same contract/dispatch/gate loop that any user would run.

- The fleet built armada's session-based state system in **~26 minutes**, at a cost of **$0.18**, running fully autonomously. Blank contract to working code with passing tests.
- It surfaced a real permission deadlock — a case where the Commodore's deny-all-edit rule conflicted with a state-write. The fleet asked the right question instead of silently failing.
- QA caught and the loop self-corrected **3 test failures** the developers introduced. The gate sent them back; they fixed them.

Every feature armada ships was built by armada. [Read the full story →](./docs/WHY.md#what-we-learned-building-it)

## Learn more

- **[Website](https://rafmacalaba.github.io/armada/)** — visual walkthrough of the loop, the fleet, and what each phase produces.
- **[Getting started](./docs/getting-started.md)** — your first feature, end to end.
- **[User guide](./docs/user-guide.md)** — fleet concepts, roles, day-to-day usage.
- **[Why armada?](./docs/WHY.md)** — the case for loop engineering over one-shot prompting.
- **[Architecture](./ARCHITECTURE.md)** — the full technical deep dive.
- **[Operator guide](./docs/operator-guide.md)** — CLI reference, upgrades, rollback.

## License

MIT. See [LICENSE](./LICENSE).
