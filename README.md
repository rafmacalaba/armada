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
- **Token-lean.** Agent prompts use terse, caveman-style output contracts. Orchestrator context
  stays coordination-only; workers run in child sessions.
- **Enforced boundaries.** Each role has SDK-level file permissions (like the
  [personal-space](https://github.com/ed-donner/personal-space) pattern): qa read-only on
  product code, devs can't touch e2e/DEFECTS.md, adversary only its ledger.

---

## Prerequisites

- [opencode](https://opencode.ai) installed
- oh-my-opencode-slim installed globally (add to `plugin` in
  `~/.config/opencode/opencode.json`):
  ```bash
  bunx oh-my-opencode-slim@latest install --preset=opencode-go
  ```
- Provider auth: `opencode auth login` (OpenCode Go for free models, OpenRouter for fallbacks)
- For background orchestration, start opencode with:
  ```bash
  OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true opencode
  ```

---

## Quick start

```bash
# from your repo root
bunx opencode-armada init          # interactive questionnaire
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
    │   ├── orchestrator.md
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
| `armada init` | interactive setup |
| `armada init --budget <free\|balanced\|power>` | declarative |
| `armada init --stack <hint> --no-browser` | declarative flags |
| `armada init --from-armada armada.yaml` | re-scaffold from manifest |
| `armada init --dry-run` | print files without writing |
| `armada init --yes` | non-interactive defaults (no TTY) |
| `armada init --headless` | CI-safe: orchestrator bash allowed, no `ask` prompts |
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
| backend-dev | `opencode-go/kimi-k2.7-code` | `openrouter/z-ai/glm-5.2` |
| frontend-dev | `opencode-go/minimax-m3` | `openrouter/minimax/minimax-m3` |
| qa | `opencode/mimo-v2.5-free` | `openrouter/xiaomi/mimo-v2.5` |
| adversary | `opencode/deepseek-v4-pro` | `openrouter/deepseek/deepseek-v4-pro` |
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

## Self-dogfood

armada is dogfooded on itself: `armada init --headless` scaffolds the team into this repo, and
`opencode run` (or the live TUI) lets the team review armada's own `src/` — a CI-friendly loop
for finding real gaps. The first runs already caught bugs. See
[docs/self-dogfood.md](./docs/self-dogfood.md) for the full how-to, and
[docs/validation.md](./docs/validation.md) for the recorded results.

---

## License

MIT. See [LICENSE](./LICENSE).
