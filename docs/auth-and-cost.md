# Auth and cost

Providers, model selection, cost expectations, rate limits, and recovery.

## Providers

armada works with two provider families, both consumed through opencode:

| Provider | Role | When |
|---|---|---|
| **opencode providers** (`opencode-go/...`, `opencode/...`) | primary models for every role | default; free tier available (`*-free` models) |
| **OpenRouter** (`openrouter/...`) | fallback models, power-tier models | optional; needed for the power budget |

Auth is handled by opencode itself, not by armada:

- Default opencode provider auth: `opencode`'s own login flow (see opencode docs).
- OpenRouter: run `/connect openrouter` inside opencode, or set `OPENROUTER_API_KEY`. The
  doctor check reports which one it found and prints the remediation hint when neither is
  present (`src/doctor.js:100-111`).

The generated `opencode.json` declares the OpenRouter models the catalog uses, each with
`options.provider.allow_fallbacks: true` so a primary failure falls back rather than failing
the turn (see the generated `opencode.json` in any armed repo).

## Model selection

Budget tiers select per-role models (`src/model-catalog.js:8-11`, `src/cli.js:325-333`):

| Tier | Policy | Cost hint (from `src/init-summary.js:4-8`) |
|---|---|---|
| `free` | opencode `*-free` models only | zero usage cost |
| `balanced` (default) | free workers, paid/strong judges (orchestrator, adversary) | free workers, paid reviewers/judges |
| `power` | strongest models on every role | strongest models on every role (paid) |

Set the tier at init (`armada init --budget power`) or later via
`armada init --budget <name>` on an existing manifest. The per-role table:

| Role key | Primary (opencode) | Fallback (openrouter) |
|---|---|---|
| `orchestrator` | `opencode-go/minimax-m3` | `openrouter/z-ai/glm-5.2` |
| `backend-dev` | `opencode-go/deepseek-v4-pro` | `openrouter/deepseek/deepseek-v4-pro` |
| `frontend-dev` | `opencode-go/minimax-m3` | `openrouter/minimax/minimax-m3` |
| `qa` | `opencode/mimo-v2.5-free` | `openrouter/xiaomi/mimo-v2.5` |
| `adversary` | `opencode-go/deepseek-v4-pro` | `openrouter/deepseek/deepseek-v4-pro` |
| `security` | `opencode/big-pickle` | `openrouter/deepseek/deepseek-v4-pro` |
| `docs` | `opencode/deepseek-v4-flash-free` | `openrouter/minimax/minimax-m3` |
| `architect` | `opencode/big-pickle` | `openrouter/z-ai/glm-5.2` |

Source: `src/model-catalog.js:34-100`. `armada models [budget]` prints the current table;
`armada models --refresh` merges live provider availability into
`~/.armada/models.cache.json` (`src/model-catalog.js:116-118`); `armada models
--list-openrouter` shows the live OpenRouter list. Override a role's model in
`armada/armada.yaml` -> `team:` entry (`role`, `model`, `fallback`, `enabled`; see the
manifest at `armada/armada.yaml:44`), then re-scaffold with
`armada init --from-armada armada/armada.yaml`.

### Discounted OpenRouter Models & Provider Ordering

OpenRouter offers third-party provider backends (e.g. Novita, StreamLake, Xiaomi, GMICloud, DeepInfra) that frequently offer **4x to 20x price discounts** over standard endpoints.

- **Inspect Live Discounts:** Run `armada models --discounts` to query OpenRouter's live API endpoints, calculate per-1M-token prompt/completion pricing, and display provider savings multipliers.
- **Set Provider Ordering via CLI:**
  ```bash
  armada init --openrouter-provider Novita
  # or multiple preferred providers in priority order:
  armada init --openrouter-provider "Novita, StreamLake"
  ```
- **Set Provider Ordering via Manifest (`armada.yaml`):**
  ```yaml
  project:
    name: my-project
    budget: balanced
    openrouter_providers:
      - Novita
      - StreamLake
  ```
When configured, Armada automatically injects `"order": ["Novita", "StreamLake"]` into `options.provider` for all OpenRouter model definitions in `opencode.json`, ensuring OpenRouter prioritizes the cheapest provider first.

## Cost expectations

Costs are provider-billed (opencode providers and OpenRouter bill the account that owns the
credential); armada itself is free, MIT-licensed, and adds no markup. What a run costs
depends on the budget tier and how much the fleet works:

- `free` tier — zero usage cost on the `*-free` models (subject to provider free-tier
  limits).
- `balanced` tier — free worker models; the orchestrator and adversary run paid models, so a
  long voyage has small per-turn cost on those two roles.
- `power` tier — paid models on every role; the most expensive option, intended for
  quality-critical work.

The init summary prints the cost hint for the chosen tier (`src/init-summary.js:4-8,
15-21`). The fleet dashboard shows per-lane cost where the provider reports it
(`armada fleet`, `src/fleet-cmd.js`).

## Rate limits

armada does not impose rate limits of its own. You are subject to the provider's limits on
the credential you use (opencode providers and OpenRouter both have per-key rate limits and
tiered plans). Practical notes:

- Parallel background dispatch (several subagents at once) multiplies concurrent token use —
  watch provider rate-limit errors if you run many lanes.
- `allow_fallbacks: true` on the declared OpenRouter models keeps a primary-rate-limited
  turn from hard-failing (generated `opencode.json`).
- `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true` enables native parallel background
  subagents; without it, dispatch falls back to inline (doctor reports which mode you are in,
  `src/doctor.js:113-120`).

## Recovery

Interrupted sessions are the designed-for failure mode; recovery is restart-proof:

- `armada resume` reads `armada/state/`, prints the resume line (active feature, phase, next
  action) plus one line per evidence drift, and exits 0 when clean or 2 when drifts are
  reported (`src/cli.js:75-77`). Read-only — it never auto-fails a phase.
- `armada reconcile` is a documented alias of `resume` with identical behavior.
- The orchestrator reads `armada/state/active.json` on session start and writes it on every
  transition, so a killed session resumes without state loss (orchestrator prompt hard
  rules; `src/state.js`).
- `armada fleet` shows STALLED lanes after 2 minutes without a heartbeat
  (`src/fleet-tracker.js:117`); re-attach with `armada voyage sandbox/<name>` or
  `armada voyage attach <name>`.
- Provider auth loss (e.g. expired key) is a doctor-check failure, not data loss — fix the
  credential and `armada resume`.

See [troubleshooting.md](./troubleshooting.md) for the failure-mode table.

## Self-check

Files read to verify every claim:

- `src/model-catalog.js:1-120` — provider IDs, catalog table, budgets, cache path.
- `src/init-summary.js:4-8` — cost hints per tier.
- `src/doctor.js:100-111` (openrouter auth check), `113-120` (background dispatch),
  `184-219` (plugin checks).
- `src/cli.js:325-359` — budget/plugin flag wiring; `src/cli.js:75-77` — resume exit codes.
- `opencode.json` (generated) — `provider.openrouter.models` with `allow_fallbacks`.
  (P-15 auth docs, P-16 cost docs, P-17 recovery split — closed by this doc; see
  [CHANGELOG.md](../CHANGELOG.md)).
- `src/fleet-tracker.js:117` (STALLED threshold) — referenced via P0 evidence.

Verdict: PASS — every provider, model ID, cost hint, and recovery path matches current code.
Date: 2026-08-05.
