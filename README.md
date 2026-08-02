[![npm version](https://img.shields.io/npm/v/opencode-armada)](https://www.npmjs.com/package/opencode-armada)
[![License: MIT](https://img.shields.io/npm/l/opencode-armada)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/rafmacalaba/opencode-armada/ci.yml)](https://github.com/rafmacalaba/opencode-armada/actions)
[![Node](https://img.shields.io/node/v/opencode-armada)](https://nodejs.org)

**Reproducible AI-engineer multi-agent teams for [opencode](https://opencode.ai).** Install
armada into an existing repo, or start a brand-new one with a curated stack — then a configured
team of specialized agents (backend, frontend, qa, adversary, security, docs, architect) plus an
orchestrator that plans, delegates, and gates phases is ready the first time you open opencode.
Stack-aware from your repo's actual manifests. Per-repo and reproducible via a single manifest
file. MIT-licensed.

Runs with either runtime — `npx` (node) or `bunx` (bun), same package.

```bash
# start a fresh project, cookiecutter-style — picks the curated stack
npx opencode-armada new my-app --type web-app --beginner --yes   # or: bunx opencode-armada new ...
cd my-app
opencode                            # launch opencode — the team loads
# in the TUI:
"Implement the /admin dashboard"   # orchestrator delegates in parallel
```

- **Orchestrator that plans and gates** — drafts the contract with you, runs phases, requires
  evidence at every gate before unlocking the next.
- **Specialists that run in parallel** — backend-dev + frontend-dev per phase, independent phases
  advance together, nothing blocks on something that doesn't depend on it.
- **Boundaries that can't be bypassed** — per-role file permissions enforced by the SDK; qa is
  read-only on product code, devs are locked out of `e2e/` and `DEFECTS.md`.

[read more ↓](#why)

---

# opencode-armada

Reproducible **AI-engineer multi-agent teams** for [opencode](https://opencode.ai), built on
[oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim).

`armada init` asks a few questions (or reads a manifest), inspects your repo's tech stack, and
scaffolds a configured team of specialized agents — backend-dev, frontend-dev, qa, adversary,
security, docs, architect — plus an orchestrator that plans, delegates, and gates phases.

Public. Transparent. MIT-licensed. Full spec in [SPEC.md](./SPEC.md).

---

## Why

- **Auto-routes and delegates.** The orchestrator schedules background specialists, tracks
  file ownership, reconciles results, and verifies — using omo-slim's native background
  orchestration.
- **Stack-aware agents.** Prompts are generated from your repo's actual stack (detected from
  package.json / pyproject.toml / requirements.txt / Dockerfile), not generic boilerplate.
- **Per-repo, reproducible.** `armada.yaml` is the manifest. Re-run `armada init
  --from-armada armada.yaml` anywhere to reproduce the identical team.
- **Model choice per role.** Primary = opencode/go-zen models (free where available), fallback
  = equivalent OpenRouter models. Choose a budget tier: free / balanced / power.
- **Token-lean.** Agent prompts use terse, caveman-style output contracts. Armada-orchestrator
  context stays coordination-only; workers run in child sessions.
- **Enforced boundaries.** Each role has SDK-level file permissions (like the
  [personal-space](https://github.com/ed-donner/personal-space) pattern): qa read-only on
  product code, devs can't touch e2e/DEFECTS.md, adversary only its ledger.

---

## How you use it

armada is a **one-time generator** (the create-react-app model, not a runtime). You run it
once, it writes the team config, and you're done — from then on you just use `opencode`, where
omo-slim runs the team.

There are two ways to install armada:

- **`armada new <name>`** — fresh project, cookiecutter-style. Picks a curated starter template
  for your category, scaffolds the directory, then runs `armada init` inside so the team is
  ready the first time you open opencode.
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

The orchestrator is the omo-slim primary agent. Armada keeps that slot (it must — omo-slim
grants `mode: primary` and the background-job board only to the agent named `orchestrator`) and
**appends** the armada delivery protocol to its prompt (`orchestrator_append.md`), so the
superpowers orchestration stays intact. The TUI shows it as **armada-orchestrator** via a
`displayName`; the internal name never changes.

Everything below this line (`--headless`, `--requirements`, `--budget`, …) is a **setup-time
option** on step 1. There is no armada at runtime.

---

## Prerequisites

- [opencode](https://opencode.ai) installed
- oh-my-opencode-slim installed globally (add to `plugin` in
  `~/.config/opencode/opencode.json`):
  ```bash
  npx oh-my-opencode-slim@latest install --preset=opencode-go   # or: bunx oh-my-opencode-slim@latest install ...
  ```
- Provider auth: `opencode auth login` (OpenCode Go for free models, OpenRouter for fallbacks)
- omo-slim handles background orchestration automatically. Optionally enable opencode-native
  parallel dispatch with:
  ```bash
  OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true opencode
  ```

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
# /armada                          # team status
# "ping all agents"                # verify the roster is online
```

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
├── opencode.json                     # project model + permissions (never clobbers existing)
├── AGENTS.md                         # playbook: team roles, defect ledger, phase gates (if absent)
├── REQUIREMENTS.md                   # contract scaffold: phases + success criteria (if absent)
├── armada.yaml                       # manifest — source of truth, re-runnable
└── .opencode/
    ├── oh-my-opencode-slim.jsonc     # preset + agent definitions (model, permission, routing)
    ├── oh-my-opencode-slim/          # stack-aware system prompts per agent
    │   ├── orchestrator_append.md    # armada delivery protocol (appended to omo-slim orchestrator)
    │   ├── backend-dev.md
    │   ├── frontend-dev.md
    │   ├── qa.md / adversary.md / security.md / docs.md / architect.md
    └── commands/armada.md            # /armada in-session command
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
| `armada models [budget]` | show curated model catalog |
| `armada models --refresh --cache <path>` | merge live provider models (cache to path) |
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
| **orchestrator** | plans, delegates, reviews, gates phases. Never writes code | markdown ledgers only |
| **backend-dev** | server, API, storage, seed data, backend unit tests | product code; denied e2e/DEFECTS |
| **frontend-dev** | UI/UX implementation, visual polish, frontend unit tests | product code; denied e2e/DEFECTS |
| **qa** | e2e tests, screenshots, owns DEFECTS.md, retests/closes defects | e2e/, DEFECTS.md, screenshots/ only |
| **adversary** | hostile-user testing, breaks the running app | ADVERSARIAL_REVIEW.md, screenshots/ |
| **security** | vulnerability audit, auth/authz, dependency risk | read-only |
| **docs** | README, API docs, changelog | docs; denied e2e/.opencode |
| **architect** | architecture, refactor risk, review | read-only |

---

## Model catalog

Primary models run on opencode/go-zen (free where available); fallbacks are equivalent
OpenRouter models. Edit `src/model-catalog.js` or use `/preset` in opencode to change them.

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
two-lane how-to, and [docs/validation.md](./docs/validation.md) for the recorded results.

---

## License

MIT. See [LICENSE](./LICENSE).
