[![npm version](https://img.shields.io/npm/v/opencode-armada)](https://www.npmjs.com/package/opencode-armada)
[![License: MIT](https://img.shields.io/npm/l/opencode-armada)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/rafmacalaba/opencode-armada/ci.yml)](https://github.com/rafmacalaba/opencode-armada/actions)
[![Node](https://img.shields.io/node/v/opencode-armada)](https://nodejs.org)

**Evidence-gated AI teams for [opencode](https://opencode.ai).** A crew — orchestrator, backend,
frontend, qa, adversary, security, docs, architect — that ships work **only on proof**: a phase
unlocks when its tests pass and evidence is shown, a defect closes only when qa retests it, and
role boundaries are enforced by the SDK, not by a prompt. One command scaffolds the team into your
repo, stack-aware and reproducible from a single manifest. The session is **restart-proof**: the
fleet's progress lives in `armada/state/`, so a killed session resumes exactly where it left off.
MIT-licensed.

Runs with either runtime — `npx` (node) or `bunx` (bun), same package.

```bash
# start a fresh project, cookiecutter-style — picks the curated stack
npx opencode-armada new my-app --type web-app --beginner --yes   # or: bunx opencode-armada new ...
cd my-app
opencode                            # launch opencode — the team loads
# in the TUI:
"Implement the /admin dashboard"   # orchestrator delegates in parallel
```

- **Nothing ships on a word.** A phase passes on evidence — a green test run, a screenshot — and
  you approve at every gate. A developer's "it's fixed" never closes a defect; only qa does.
- **Parallel by dependency.** backend-dev and frontend-dev advance independent phases together;
  nothing blocks on work it doesn't depend on.
- **Boundaries you can't talk your way past.** Per-role SDK permissions: qa read-only on product
  code, devs locked out of `armada/e2e/<feature>/` and `armada/ledgers/<feature>/`, adversary confined to its ledger.

[read more ↓](#why)

---

# opencode-armada

**Evidence-gated AI teams** for [opencode](https://opencode.ai).

armada is the process, not just the prompts. It scaffolds a crew of specialized agents —
backend-dev, frontend-dev, qa, adversary, security, docs, architect — under an orchestrator that
writes a contract with you, runs it in gated phases, and demands evidence at every gate. The
boring-sounding part — reproducible from one manifest — is what makes it trustable: `armada init
--from-armada armada.yaml` rebuilds the identical team anywhere.

It fuses two engineering ideas, explained fully in [ARCHITECTURE.md](./ARCHITECTURE.md): the repo
as a **harness** (enforcement is mechanical — SDK permissions in agent frontmatter, not prompt
politeness) and the orchestrator as a **loop** (plan → dispatch → verify → gate → next, with
state as the loop's memory).

Public. Transparent. MIT-licensed. Full spec in [SPEC.md](./SPEC.md).

---

## Why

- **Ships on evidence, not promises.** The orchestrator co-writes `REQUIREMENTS.md` with you,
  runs it in phases, and unlocks the next phase only when the current one shows proof — a passing
  test run, a screenshot, or both. You approve at the gates.
- **Defects close on retest, not on claim.** `armada/ledgers/<feature>/DEFECTS.md` — a per-feature
  defect ledger — is owned by qa: a developer's "fixed" is filed FIX-READY, but only qa's
  passing retest closes it. A dev's word can't clear a bug.
- **Hostile review is a role, not an afterthought.** The adversary tries to break the running app
  and files findings to `armada/ledgers/<feature>/ADVERSARIAL_REVIEW.md`; security audits auth, authz, and dependency risk.
- **Boundaries enforced, not requested.** SDK-level file permissions per role: qa read-only on
  product code, devs locked out of `armada/e2e/<feature>/` and `armada/ledgers/<feature>/`. There is no "please don't" prompt.
- **Parallel by dependency.** Independent phases advance together as background subagents; nothing
  blocks on work it doesn't depend on.
- **Reproducible from one file.** `armada.yaml` is the manifest; `armada init --from-armada`
  rebuilds the identical team anywhere. Stack-aware prompts, per-role model choice, free-tier
  support, and terse token-lean output contracts come along for free.

---

## How you use it

You run armada once; it writes the team into your repo, and from then on you just use `opencode`
(opencode runs the crew natively (background subagents)). It's a **one-time generator** — the
create-react-app model, not a runtime — and what it generates is a process, not just a pile of
prompts.

There are two ways to install armada:

- **`armada new <name>`** — fresh project, cookiecutter-style. Picks a curated starter template
  for your category, scaffolds the directory, then runs `armada init` inside so the team is
  ready the first time you open opencode. Templates ship agentic-repo best practices out of the
  box: `AGENTS.md`, `LICENSE`, `CONTRIBUTING.md`, CI workflow, `.env.example`, and a TDD test
  bootstrap.
- **`armada init`** — add the team to an existing repo. Detects your stack from
  `package.json` / `pyproject.toml` / `requirements.txt` / `Dockerfile` and scaffolds around it.

Both end in the same place: a directory you `cd` into, run `opencode`, and start delegating.

```bash
# Path A: fresh project (cookiecutter-style)
npx opencode-armada new my-app --type web-app --beginner --yes   # or: bunx opencode-armada new ...
cd my-app
opencode

# Path B: existing repo
cd my-existing-repo
npx opencode-armada init            # or: bunx opencode-armada init
opencode
```

That's it — the orchestrator co-writes `REQUIREMENTS.md` with you by default (blank contract →
it asks clarifying questions, drafts phases + success criteria, iterates until you approve).
You don't ask it to; it's how it starts. Then it implements: backend-dev and frontend-dev run as
**parallel background subagents** per phase, and independent phases progress in parallel —
nothing blocks a phase except an unmet dependency or a failed success criterion. You approve at
gates and review the PR.

Every phase transition is written to `armada/state/` — so the session is **restart-proof**. Kill
opencode mid-feature and reopen: the orchestrator reads state and reports *"resume: feature X,
phase 2, evidence in, next action Y"* (or run `armada reconcile`). Per-feature contracts live in
`armada/state/features/`, tracked by `armada feature new/list/close`.

The orchestrator is armada's primary agent (`mode: primary`) and the repo's `default_agent`, so
the TUI boots straight into it. Its prompt is self-contained — nothing is appended at runtime.

Everything in the setup-time options below (`--headless`, `--requirements`, `--budget`, …) is a
**setup-time option** on step 1. After that, the fleet runs as native opencode agents with a small,
reproducible runtime footprint: the **state area** (`armada/state/`, written by the fleet at every
phase transition) and the **CLI** (`armada status`, `armada scout <area>`, `armada reconcile`,
`armada fleet [session]`).

---

## Glossary: armada terminology

Fleet terms are user-facing; plumbing (branch names, `armada feature`, worktree mechanics, the
literal `sandbox/` directory path, manifest keys, file names) is unchanged.

| Fleet term | Meaning | Role key |
|---|---|---|
| **Admiral** | the human operator (the contract's signing party) | (no role key) |
| **Commodore** | orchestrator — plans, delegates, reviews, gates phases | `orchestrator` |
| **Galleon** | backend-dev — server, API, storage, seed data, backend unit tests | `backend-dev` |
| **Clipper** | frontend-dev — UI/UX implementation, visual polish, frontend unit tests | `frontend-dev` |
| **Corvette** | qa — e2e tests, screenshots, owns DEFECTS.md | `qa` |
| **Xebec** | adversary — hostile-user testing, breaks the running app | `adversary` |
| **Frigate** | security — vulnerability audit, auth/authz, dependency risk | `security` |
| **Caravel** | docs — README, API docs, changelog | `docs` |
| **Bark** | architect — architecture, refactor risk, review | `architect` |
| **patrol** | an audit run — the recurring review of armada's own code | (no role key) |
| **voyage** | a feature implementation run — ships a TODO item or feature as a reviewed PR | (no role key) |
| **dock** | the `sandbox/<name>/` worktree a patrol or voyage runs in | (no role key) |
| **ship name** | the tmux session name a dock runs under | (no role key) |
| **`armada voyage`** | the new user-facing name for booting a dock; `armada drive` stays as a hidden alias | (no role key) |

> **Old terminology:** Lane A (audit run) → patrol, Lane B (feature implementation run) → voyage,
> sandbox/<name> (lane worktree) → dock, tmux session name → ship name, `armada drive` →
> `armada voyage` (drive stays a hidden alias).

---

## Prerequisites

- [opencode](https://opencode.ai) installed
- Provider auth: `opencode auth login` (OpenCode Go for free models, OpenRouter for fallbacks)
- For parallel background dispatch, launch opencode with:
  ```bash
  OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true opencode
  ```

### OpenRouter

Armada uses OpenRouter as the cross-provider model layer. The `balanced` preset uses it for
fallbacks; the `power` preset is OpenRouter-only. A scaffolded `opencode.json` registers every
OpenRouter model armada references (with provider failover), so they work even if opencode's
preloaded OpenRouter list lags.

- One-time: `opencode` → `/connect` → **OpenRouter** → paste your key (or set
  `OPENROUTER_API_KEY`).
- Verify: `armada doctor` — an `openrouter auth` check reports the credential.
- Override a role's model: `armada/armada.yaml` → `agents.<role>.model:
  "openrouter/<slug>"` (e.g. `openrouter/~anthropic/claude-sonnet-latest`).
- Budgets: `armada init --budget free|balanced|power`.
- Autonomous: `armada init --yolo` — no permission prompts (bash allow; role edit boundaries
  kept). Then `opencode run --agent orchestrator "run armada/REQUIREMENTS.md"` runs the fleet
  hands-off, phases in parallel.

---

## Quick start

### Create a new project (cookiecutter-style)

```bash
# interactive: pick a category, then beginner or experienced
armada new my-app

# non-interactive: curated stack for a web app, no questions
armada new my-app --type web-app --beginner --yes
```

Three categories ship today:

| Category | Recommended stack | What you get |
|---|---|---|
| `web-app` | Next.js 15 + Tailwind 4 + TypeScript | React app, ESLint, GitHub Actions, Vercel-ready |
| `ml-training` | Python + PyTorch + uv | pyproject, train script, pytest, ruff/black |
| `research-paper` | LaTeX + Makefile | main.tex, Makefile, .gitignore, Zotero-ready bib |

The **beginner path** picks the recommended stack per category. The **experienced path** drills
down per layer (frontend framework, backend, database, testing, CI, deploy) and renders the
recommendations accordingly. Both end in the same place: a directory you can `cd` into, run
`opencode`, and have the team ready.

`armada new` is the cookiecutter-style entry point: a single command does the stack pick, the
starter copy, and the team install. No git clone → template copy → `armada init` dance.

### Add the team to an existing repo

```bash
# from your repo root
npx opencode-armada init            # interactive questionnaire — or: bunx opencode-armada init
opencode                            # start opencode
armada status                       # team status (in another terminal)
# "ping all agents"                # verify the roster is online
```

`armada init` ends with a summary: team size, budget, cost hint, per-role model roster, and next
steps.

### Declarative / CI

```bash
armada init --budget free --stack nextjs-fastapi --no-browser
```

### Reproduce from manifest

```bash
armada init --from-armada armada.yaml
```

---

## What gets generated

```
your-repo/
├── opencode.json                     # model + default_agent (never clobbers existing)
├── AGENTS.md                         # playbook: team roles, defect ledger, phase gates (if absent)
├── REQUIREMENTS.md                   # contract scaffold: phases + success criteria (if absent)
├── armada.yaml                       # manifest — source of truth, re-runnable
├── armada/
│   ├── state/                        # the loop's memory — written by the fleet, restart-proof
│   │   ├── active.json               # active feature, phase graph, evidence, next action
│   │   └── features/                 # per-feature contracts + index.json
│   ├── ledgers/
│   │   ├── <feature>/DEFECTS.md      # per-feature defect ledger (qa-owned)
│   │   ├── <feature>/ADVERSARIAL_REVIEW.md  # per-feature adversarial findings
│   │   └── shared/                   # cross-feature defects
│   ├── e2e/<feature>/                # per-feature e2e evidence (qa-owned)
│   └── screenshots/<feature>/        # per-feature screenshot evidence
└── .opencode/
    ├── agent/                        # native opencode agents: mode/model/permission frontmatter
    │   ├── orchestrator.md           # primary agent, default_agent, self-contained prompt
    │   ├── backend-dev.md
    │   ├── frontend-dev.md
    │   └── qa.md / adversary.md / security.md / docs.md / architect.md
```

When browser/e2e testing is enabled, `.devcontainer/` (opencode + agent-browser + chromium)
is also scaffolded.

---

## CLI

| Command | Purpose |
|---------|---------|
| `armada new <name>` | scaffold a new project from a curated starter + run `init` |
| `armada new <name> --type <web-app\|ml-training\|research-paper>` | non-interactive category |
| `armada new <name> --beginner` | use the recommended stack (default flow) |
| `armada new <name> --experienced` | drill down per layer (frontend, backend, db, test, CI, deploy) |
| `armada new <name> --yes` | skip all prompts (use with `--type` + `--beginner`/`--experienced`) |
| `armada init` | interactive setup |
| `armada init --budget <free\|balanced\|power>` | declarative |
| `armada init --stack <hint> --no-browser` | declarative flags |
| `armada init --from-armada armada.yaml` | re-scaffold from manifest |
| `armada init --dry-run` | print files without writing |
| `armada init --yes` | non-interactive defaults (no TTY) |
| `armada init --headless` | CI-safe: orchestrator bash allowed, no `ask` prompts |
| `armada init --requirements <file>` | per-feature contract file (default `REQUIREMENTS.md`) |
| `armada update [--yes] [--dry-run] [--repo <path>]` | bring an existing repo fully current: re-scaffold + whitelist-only opencode.json merge |
| `armada feature new <name>` | start a feature: creates the contract + state, sets it active |
| `armada feature list` | list all features from the state index |
| `armada feature close <name>` | close a feature (evidence-gated — refuses until criteria pass) |
| `armada feature status [name]` | show a feature's phase graph + evidence |
| `armada status [--json]` | active feature + next action from `armada/state` (table; `--json` for machine output) |
| `armada scout <area>` | print an investigation brief for a code area |
| `armada reconcile [--json] [--state-dir <path>] [--repo <path>]` | resume after an interrupted session (drift list) |
| `armada fleet [session] [--json] [--open]` | per-lane progress dashboard |
| `armada models [budget]` | show curated model catalog (first-choice model tagged `(Recommended)`) |
| `armada models --refresh --cache <path>` | merge live provider models (cache to path) |
| `armada models --list-openrouter` | show live model list from the OpenRouter API |
| `armada preset <name> [--target <dir>]` | apply a budget preset to armada.yaml |
| `armada voyage <lane-path>` | boot a lane session and send the voyage prompt |
| `armada drive <lane-path>` | (alias for `armada voyage`; auto-opens in wezterm — preferred — else per-OS emulator) |
| `armada doctor` | environment health check |
| `armada uninstall` | remove armada-generated artifacts |
| `armada uninstall --all` | also remove generated `AGENTS.md`/`opencode.json`/`REQUIREMENTS.md` |
| `armada uninstall --dry-run` | print what would be removed |
| `armada ping` | sanity check |
| `armada help` | usage |

---

## The team

| Role | What it does | File access |
|---|---|---|
| **orchestrator** | plans, delegates, reviews, gates phases. Never writes code | `armada/ledgers/<feature>/` only |
| **backend-dev** | server, API, storage, seed data, backend unit tests | product code; denied ledger/e2e/screenshots |
| **frontend-dev** | UI/UX implementation, visual polish, frontend unit tests | product code; denied ledger/e2e/screenshots |
| **qa** | e2e tests, screenshots, owns DEFECTS.md, retests/closes defects | `armada/e2e/<feature>/`, `armada/ledgers/<feature>/`, `armada/screenshots/<feature>/` |
| **adversary** | hostile-user testing, breaks the running app | `armada/ledgers/<feature>/ADVERSARIAL_REVIEW.md`, `armada/screenshots/<feature>/` |
| **security** | vulnerability audit, auth/authz, dependency risk | read-only |
| **docs** | README, API docs, changelog | docs; denied `armada/e2e/`, `.opencode/` |
| **architect** | architecture, refactor risk, review | read-only |

---

## Model catalog

Primary models run on opencode/go-zen (free where available); fallbacks are equivalent
OpenRouter models. Change models per role by editing `src/model-catalog.js` (armada dev) or
overriding in `armada/armada.yaml` (`agents.<role>.model: "openrouter/<slug>"`), then re-running
`armada init --from-armada armada/armada.yaml`. `armada models [budget]` tags the budget's
first-choice model with `(Recommended)`; `armada models --list-openrouter` prints the live
OpenRouter model list for pick-your-own workflows.

| Role | Primary (opencode) | Fallback (openrouter) |
|---|---|---|
| orchestrator | `opencode-go/minimax-m3` | `openrouter/z-ai/glm-5.2` |
| backend-dev | `opencode-go/deepseek-v4-pro` | `openrouter/deepseek/deepseek-v4-pro` |
| frontend-dev | `opencode-go/minimax-m3` | `openrouter/minimax/minimax-m3` |
| qa | `opencode/mimo-v2.5-free` | `openrouter/xiaomi/mimo-v2.5` |
| adversary | `opencode-go/deepseek-v4-pro` | `openrouter/deepseek/deepseek-v4-pro` |
| security | `opencode/big-pickle` | `openrouter/deepseek/deepseek-v4-pro` |
| docs | `opencode/deepseek-v4-flash-free` | `openrouter/minimax/minimax-m3` |
| architect | `opencode/big-pickle` | `openrouter/z-ai/glm-5.2` |

---

## Development

```bash
git clone git@github.com:rafaelmacalaba/opencode-armada.git
cd opencode-armada
bun install        # or npm install
bun test           # node --test tests/*.test.js
node src/cli.js help
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the code layout and [TODO.md](./TODO.md) for the
roadmap and open work. To cut a release (npm + GitHub): [docs/RELEASING.md](./docs/RELEASING.md).

## Armada improves armada

armada is dogfooded on itself: a team is scaffolded into a `sandbox/<name>/` worktree and either
**audits** armada's own `src/` (recurring) or **implements** features from TODO.md (landing
page, `armada new`, bugfixes). Worktrees keep the live repo pristine; the first runs already
caught bugs. See [docs/armada-improves-armada.md](./docs/armada-improves-armada.md) for the
patrol/voyage how-to, and [docs/validation.md](./docs/validation.md) for the recorded results.

---

## License

MIT. See [LICENSE](./LICENSE).
