# Robust opencode Harness — Implementation Plan (Tiered)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan tier-by-tier. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `opencode-armada` robust on the opencode harness while preserving the core fleet model — **subagents + orchestrator, runnable in parallel** (the model armada already uses and that firstmate uses for its multi-harness crews). Multi-harness (codex, claude code) is parked as a TODO; this plan ships the opencode-grade version first.

## Key concepts preserved (do not regress)

- **Subagents are the workers.** `backend-dev`, `frontend-dev`, `qa`, `adversary`, `security`, `docs`, `architect` — dispatched by the orchestrator. They own their slice; they never write outside their permission set.
- **Orchestrator is the only coordinator.** `default_agent: "orchestrator"`, color `#00bcd4`, internal name stays `orchestrator` (routing + background-job board depend on it). The orchestrator **delegates writes**; it does not edit code directly.
- **Parallel execution is the default.** Independent phases run as **background subagents in parallel** (opencode's `task` tool with background mode, gated on `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`). Dependency-driven: a phase starts as soon as its dependencies pass — same model firstmate uses for its parallel crewmates.
- **Evidence-gated delivery.** Phases ship on proof (tests, lint, build artifacts). Defects close on retest. Boundaries enforced by the SDK (`permission:` field in frontmatter; `external_directory: deny` in `opencode.json`) — not just prompts.

If a tier would change any of the four, it is wrong — stop and re-design.

## Constraints / "the promise" (hold the line)

- **Zero install in the target.** `git clone` (or `npm i -g opencode-armada && armada init`) is the only setup. The generated `.opencode/` is self-contained.
- **Zero plugin by default.** The generated team works with opencode alone — no plugin files in the scaffolded output. If a thin opencode plugin is needed for supervision (Tier 3), it is **opt-in** (`armada init --supervision-plugin` or `armada.yaml` `supervision.plugin: true`); the default stays plugin-free.
- **Auto-loaded, never installed.** Any plugin armada emits is a file in `.opencode/plugins/` that opencode auto-loads from the project directory. No global install, no registration, no `npm install` step for the plugin layer.
- **Generator is pure, scaffold owns I/O.** (Existing global constraint; carry forward.)
- **Tests stay green and fast.** `node --test 'tests/*.test.js'` — no network calls in tests. Each tier adds tests; nothing regresses.

## Non-goals (deferred)

- **Multi-harness support** (codex, claude code). Parked. Reference: OpenRouter cookbook for `codex-cli`, `opencode-integration`, `claude-code-integration` (already fetched). When we tackle multi-harness, the generator grows per-harness renderers; the opencode tier here is the reference implementation.
- **Ponytail / prompt compression.** Separate TODO. Don't conflate.
- **Worktree-per-task isolation.** Aspirational (firstmate's strongest idea). Tracked in TODO; not in these tiers. The prompt contract for "no blind stop" + the fleet-status file are the lightweight substitutes for now.

---

## Tier roadmap

Four tiers, sequenced to ship value early and keep each PR small + reversible. T1 + T4 can be one PR (model/provider hardening + prompt contracts/tests). T2 its own PR. T3 its own PR (needs opencode plugin API verification + a real test against opencode).

### Tier 1 — Model/provider robustness

**Goal:** An `armada init` produces a generated `opencode.json` that works on openrouter out of the box (even if opencode's preloaded openrouter list lags), with provider failover and a doctor check that surfaces the openrouter auth requirement for the `power` preset.

**Scope (in):**
- `src/generator.js` — `renderOpenCodeJson` emits `provider.openrouter.models` for every `openrouter/<slug>` referenced by the catalog, each with `options.provider: { allow_fallbacks: true }` (failover). Slugs include the `~latest` aliases the OpenRouter cookbook recommends (e.g. `~anthropic/claude-sonnet-latest`) only if the catalog picks them.
- `src/doctor.js` — add a dedicated `openrouter auth` check: runs `opencode auth list`, parses output, reports `pass` / `fail` with a one-line remediation (`/connect` openrouter, or set `OPENROUTER_API_KEY`). Surface the `power` preset's openrouter dependency explicitly.
- `src/model-catalog.js` — no schema change. Keep primary/fallback/free/power. (Catalog is the source of truth; the generator reads it.)
- Docs: README + `docs/using-armada.md` get a short "power preset needs openrouter" section + the `armada.yaml` override example (`agents.<role>.model: "openrouter/<slug>"`).

**Scope (out):** bundled commands (T2), plugin (T3), prompt contract changes (T4, folded into this PR's test additions).

**Files touched (expected):**
- `src/generator.js` — extend `renderOpenCodeJson` to read the team, collect `openrouter/*` slugs, emit `provider.openrouter.models`.
- `src/doctor.js` — new check, wired into the existing checks table.
- `tests/generator.test.js` — assert `renderOpenCodeJson` includes the openrouter models block; assert failover options present.
- `tests/doctor.test.js` (if not present, add) — stub `opencode auth list`; assert pass/fail rendering and remediation line.
- `README.md`, `docs/using-armada.md` — short openrouter-setup section.

**Acceptance:**
- `armada init` in a fresh dir produces an `opencode.json` whose `provider.openrouter.models` covers every openrouter slug the catalog uses.
- Each emitted model has `options.provider.allow_fallbacks: true`.
- `armada doctor` reports openrouter auth as a separate check, with a remediation hint on fail.
- `node --test 'tests/*.test.js'` stays green; new tests pass.
- A clean-HOME `opencode` launch in a freshly scaffolded dir can `/connect` openrouter, select an `openrouter/*` model from the picker, and run — no manual `provider.openrouter.models` edit.

**Commit message hint:** `feat(generator,doctor): openrouter robustness — provider block, failover, auth check`

---

### Tier 4 (fold into T1 PR) — Prompt contracts + regression tests

**Goal:** Codify the fleet model in the orchestrator's prompt as hard rules (not conventions) and add regression tests so the contract can't drift.

**Scope (in):**
- `agents/orchestrator/prompt.template.md` — add three explicit rules:
  1. **No blind stop:** "Never end your turn while a dispatched background subagent is still running. Wait for results or explicitly hold the turn." (Translates firstmate's `session.idle` turnend-guard intent into a prompt contract.)
  2. **Writes route through subagents:** "If the work requires writing files (code, tests, fixtures, docs edits), dispatch a subagent. Do not edit/write/patch directly." (Closes the "orchestrator does crew work" loophole; the `permission:` field blocks the most obvious paths, this rule blocks the rest.)
  3. **Read fleet status on session start:** "On session start, read `.opencode/fleet-status.md` if it exists. Summarize pending phases, ask the captain for the next action." (Pairs with T2's `/armada-resume` + T3's sessionstart nudge; the prompt knows the file even if the nudge/file aren't shipped yet.)
- `tests/scaffold.test.js` or a new `tests/prompt-contract.test.js`:
  - Assert generated orchestrator prompt contains the three rules (regex on filled prompt).
  - Assert generated `opencode.json` has no `plugin` block by default.
  - Assert the `/armada` command body references `.opencode/agent/` (already done in the recent native-mode cleanup; keep the test).

**Scope (out):** anything that needs the plugin API (T3).

**Files touched (expected):**
- `agents/orchestrator/prompt.template.md` — three rule additions.
- `tests/prompt-contract.test.js` (new) — three assertions.
- Possibly `tests/scaffold.test.js` — extend existing checks.

**Acceptance:**
- The orchestrator's filled prompt contains the three rules (test asserts).
- `opencode.json` rendered for default `armada init` has no `plugin:` key (test asserts).
- Existing 159 tests still pass; new tests pass.

**Commit message hint:** `feat(orchestrator): no-blind-stop, delegation, fleet-status prompt contracts + tests`

> **Note:** Tier 4 ships in the **same PR as Tier 1**. They are independent code-wise (generator/doctor vs prompt/tests) but pair naturally and the PR stays small.

---

### Tier 2 — Bundled skills (commands)

**Goal:** Give the fleet in-session levers. The captain can `/armada-status` to see active work, `/armada-scout` to dispatch a read-only investigation, `/armada-resume` to pick up where a killed session left off. No plugin; just opencode command files (auto-loaded by opencode like `/armada` already is).

**Scope (in):**
- `src/generator.js` — add `renderArmadaStatusCommand`, `renderArmadaScoutCommand`, `renderArmadaResumeCommand`. Each returns a markdown file with frontmatter (`description`, `agent: orchestrator`) + a body that tells the orchestrator what to do.
- `src/scaffold.js` — write the three new `.opencode/command/<name>.md` files alongside the existing `/armada`. Controlled by `armada.yaml` `commands:` keys (default: all on). `uninstall` removes them by name.
- `agents/orchestrator/prompt.template.md` — add a short reference to the three commands so the orchestrator knows they exist.
- Fleet status file: define the path (`.opencode/fleet-status.md`) and the schema (frontmatter `active_phases`, `last_update`, `next_action`; body a short markdown table). The orchestrator prompt contract (T4) already references it; T2 ships the format and the read commands.

**Scope (out):** automatic write of fleet-status.md by the orchestrator (that comes from the orchestrator's own behavior + eventually the T3 plugin; the format is defined here so it's stable).

**Files touched (expected):**
- `src/generator.js` — three render functions; extend `renderAgentsMd` or a new "commands" section.
- `src/scaffold.js` — write the command files; extend `uninstall` to remove them.
- `agents/orchestrator/prompt.template.md` — add a one-line pointer to the three commands.
- `tests/generator.test.js` — assert each render function produces the expected frontmatter + body.
- `tests/scaffold.test.js` — assert `init` writes the three files; `uninstall` removes them.
- `TODO.md` — note the fleet-status.md schema (here, so T3 can hook into it).

**Acceptance:**
- `armada init` in a fresh dir produces `.opencode/command/{armada,armada-status,armada-scout,armada-resume}.md`.
- In opencode TUI, `/armada-status` is registered and reads `.opencode/fleet-status.md` if present; else "no active fleet."
- `/armada-scout` is registered and the orchestrator routes to `adversary`/`architect` for read-only investigation (no writes).
- `/armada-resume` is registered and the orchestrator reads fleet-status, summarizes, asks the captain.
- `armada uninstall` removes the three new command files (by name), keeps user-added command files.

**Commit message hint:** `feat(commands): bundle /armada-status, /armada-scout, /armada-resume + fleet-status.md schema`

---

### Tier 3 — Thin supervision plugin (opt-in)

**Goal:** Close the three things the `permission:` field + prompt contracts can't enforce, using a single small opencode plugin file. Firstmate-grade supervision, native to opencode, **opt-in** so the "no plugin" default holds.

**Scope (in):**
- New generator: `src/generator.js` — `renderArmadaSupervisionPlugin()` returns a single `.opencode/plugins/armada-supervision.js` file. Emitted only when `armada.yaml` `supervision.plugin: true` or `armada init --supervision-plugin`.
- The plugin exports three handlers (opencode plugin API):
  1. **`session.created` → resume nudge.** If `.opencode/fleet-status.md` exists, inject its contents as a user-role message via `client.session.promptAsync` (mirrors firstmate's `fm-primary-sessionstart-nudge.js`).
  2. **`session.idle` → no blind stop.** Probe opencode's background-job state (API to verify during implementation; likely `client.session.status` or a task-list endpoint). If background work is outstanding, inject "background work outstanding — wait" via `promptAsync`. Mirrors firstmate's `fm-primary-turnend-guard.js`. Needs a `skipNextIdle` guard to prevent recursion on the synthetic prompt.
  3. **`tool.execute.before` for `bash` → shell-redirect guard.** Parse the bash command for write-redirects (`>`, `>>`, `tee <file>`, `sed -i ... <file>`). If the target file is in the orchestrator's `permission.edit` deny set, throw to deny. Closes the gap the `permission:` field can't reach (e.g. `bash: echo "x" > REQUIREMENTS.md` to bypass `edit: { REQUIREMENTS.md: "deny" }`).
- `src/doctor.js` — new check: if `supervision.plugin: true` is set, verify the generated plugin file exists; if not, warn.
- `src/scaffold.js` — write the plugin file when the flag is on; `uninstall` removes it.
- `src/cli.js` — `armada init --supervision-plugin` flag.
- `tests/` — unit tests for the plugin's handlers (mock the opencode client); integration: assert `init --supervision-plugin` produces the file, default `init` does NOT.
- `docs/using-armada.md` — section on opt-in supervision; what it adds; the tradeoff (one extra file, opt-in).

**Scope (out):** a full firstmate-equivalent (bash watcher, PID/lock/beacon, sub-supervisor). This is **one file, three handlers, opt-in** — the lightweight version.

**Files touched (expected):**
- `src/generator.js` — `renderArmadaSupervisionPlugin()`.
- `src/scaffold.js` — write/uninstall the plugin file.
- `src/cli.js` — `--supervision-plugin` flag.
- `src/doctor.js` — optional check.
- `tests/plugin.test.js` (new) — mock the opencode client; assert each handler's behavior.
- `tests/cli.test.js` — assert the flag toggles the file.
- `docs/using-armada.md` — opt-in section.

**Acceptance:**
- Default `armada init` does NOT produce `.opencode/plugins/`.
- `armada init --supervision-plugin` produces exactly one file: `.opencode/plugins/armada-supervision.js`.
- The plugin, when loaded by opencode, injects the fleet-status on `session.created` (verifiable: start opencode in a project with a fleet-status.md; TUI shows the resume content as a user message).
- The plugin denies shell-redirect writes to files in the orchestrator's `permission.edit` deny set (verifiable: orchestrator tries `echo x > REQUIREMENTS.md` → blocked with a clear message).
- The `session.idle` handler's `skipNextIdle` recursion guard works (no infinite prompt loop on synthetic injection).
- `armada uninstall --all` removes the plugin file when present; default `uninstall` leaves user plugins alone.
- All existing 159 tests still pass; new tests pass.

**Commit message hint:** `feat(plugin): opt-in thin opencode supervision plugin (session.idle, session.created, tool.execute.before)`

**Risk note:** opencode's plugin API surface for background-job state needs verification during TDD. If the API doesn't expose outstanding background tasks, the `session.idle` handler degrades to a no-op + a log line (documented). The other two handlers are independent and ship regardless.

---

## Sequencing & dependencies

```
T1 (model/provider) ──┐
                      ├── PR 1 (T1 + T4): model/provider + prompt contracts
T4 (prompt contracts) ┘

T2 (bundled commands) ──── PR 2: /armada-status, /armada-scout, /armada-resume + fleet-status schema

T3 (opt-in plugin) ────── PR 3: thin supervision plugin, opt-in
```

- **PR 1** (T1 + T4): small, no new files except the opencode.json keys + prompt lines + new test file. Unblocks openrouter users immediately. ~half a day.
- **PR 2** (T2): three new command files, three new render functions, fleet-status schema. A few hours to half a day.
- **PR 3** (T3): the meatiest. Plugin API verification + the three handlers + recursion guard + tests. Half a day to a day.

Each PR is a spec (this plan already serves as the spec for the tiered roadmap; each PR can expand its slice into step-by-step TDD at implementation time) → plan (this doc, per-tier) → TDD, following the native-mode flow.

## Deferred — multi-harness (parked)

When we tackle codex + claude code, the generator grows per-harness renderers:
- `renderOpencodeAgent` (current) → keep as-is.
- `renderCodexAgent` (codex's `AGENTS.md` + `~/.codex/...` layout).
- `renderClaudeCodeAgent` (`CLAUDE.md` + `.claude/agents/*.md` layout + `permissions.deny`).

`armada init --harness opencode|codex|claude` picks the target. The agent roster, prompts, and permission shapes adapt per harness. Reference (OpenRouter cookbook, already fetched):
- codex: `https://openrouter.ai/docs/cookbook/coding-agents/codex-cli`
- opencode: `https://openrouter.ai/docs/cookbook/coding-agents/opencode-integration`
- claude code: `https://openrouter.ai/docs/cookbook/coding-agents/claude-code-integration`

The tiers in this plan make armada the **reference opencode implementation** — the strongest one. Multi-harness then layers on top without weakening it.
