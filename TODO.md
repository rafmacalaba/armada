# opencode-armada — TODO / Roadmap

Living backlog. Pick up the next item in the next session. Add new ideas at the bottom and
link them to an issue/PR when relevant.

---

## v0.1 — done

- [x] Repo scaffold (package.json, tsconfig, LICENSE, .gitignore)
- [x] CLI: `init` / `models` / `doctor` / `ping` / `help`
- [x] Model catalog: 8 roles, primary (opencode) + fallback (openrouter), 3 budget tiers
- [x] Stack detection (package.json / pyproject / requirements / Dockerfile / instruction files)
- [x] Interactive questionnaire (zero-dep readline) + `--from-armada` + flags
- [x] Generator (pure): native agent files, opencode.json, AGENTS.md, REQUIREMENTS.md, armada.yaml
- [x] Scaffold: writes all artifacts, no-clobber on user files, devcontainer copy
- [x] Agent library: 8 roles with terse/caveman output contracts
- [x] Presets: free / balanced / power
- [x] Devcontainer + agent-browser wiring (template)
- [x] Tests: 19 passing (generator, scaffold, stack-detect)
- [x] Docs: README, SPEC, ARCHITECTURE, TODO
- [x] Standalone test harness: CLI e2e (spawns real CLI), init→parse→init round-trip, dogfood
  no-clobber, fixture corpus, real `models --refresh` e2e — 46 tests passing

## Contract co-writing — done

- [x] **Co-write the contract, don't hand-author it.** Orchestrator prompt now: if the
  requirements file's phases/criteria are blank, do NOT build — elicit requirements from the
  user one question at a time, draft, iterate to consensus, get explicit approval, then build.
- [x] **Per-feature contract files.** `armada init --requirements <file>` sets a
  per-session/feature requirements file (default `REQUIREMENTS.md`). Starting a second feature
  no longer means silently replacing the first contract. Round-trips through `armada.yaml`.
- [x] **Parallel, dependency-driven phases.** Orchestrator prompt: build the dependency graph
  from REQUIREMENTS phases; a phase starts as soon as the phases it depends on pass; independent
  phases run in parallel as background subagents (backend-dev ∥ frontend-dev per phase). Nothing
  blocks a phase except an unmet dependency or a failed success criterion.

## Robust opencode harness (tiered) — done

The fleet model was hardened on opencode: **subagents + orchestrator, runnable in parallel** (armada's model; firstmate's pattern). Multi-harness (codex, claude code) is deferred — see "Deferred" at the bottom.

- [x] **Tier 1 — Model/provider robustness.** Generated `opencode.json` emits `provider.openrouter.models` for every openrouter slug the catalog uses (each with `options.provider.allow_fallbacks: true`). `armada doctor` adds an `openrouter auth` check with a remediation hint. Docs: power preset needs `OPENROUTER_API_KEY` / `/connect` openrouter.
- [x] **Tier 4 — Prompt contracts + regression tests** (shipped in the Tier 1 PR). Orchestrator prompt gained three hard rules: (a) no blind stop, (b) writes route through subagents, (c) read `.opencode/fleet-status.md` on session start. Tests assert the three rules + assert generated `opencode.json` has no `plugin` block by default.
- [x] **Tier 2 — Bundled skills (commands).** Added `/armada-status` (read fleet status), `/armada-scout` (read-only investigation dispatch), `/armada-resume` (pick up killed session). Shipped the `.opencode/fleet-status.md` schema. Generator renders the three command files; `uninstall` removes them.
- [x] **Tier 3 — Thin supervision plugin (opt-in).** Single `.opencode/plugins/armada-supervision.js`, opt-in via `armada init --supervision-plugin` or `armada.yaml` `supervision.plugin: true`. Three handlers: `session.created` → resume nudge from fleet-status, `session.idle` → no-blind-stop guard (with `skipNextIdle` recursion guard), `tool.execute.before` for `bash` → deny shell-redirect writes to files in the orchestrator's `permission.edit` deny set. Default `armada init` does NOT emit a plugin (the "no plugin" promise holds).
- [x] **Live OpenRouter smoke layer.** `tests/smoke/` (`npm run test:smoke`) — cheapest-model ping + catalog slug resolution; skipped cleanly without a credential.
- [x] **PR sequencing delivered:** PR 1 = T1 + T4, PR 2 = T2, PR 3 = T3 (each small, CI-gated, merged to master).

## Parallel phases + autonomous mode — done

- [x] **Orchestrator prompt: "Unlock parallelism — assign disjoint files."** Prefer per-phase file
  isolation (`src/<feature>.js` + its test) so independent phases run in parallel; when a file
  must be shared, serialize writers on a reused subagent session and say so.
- [x] **`armada init --yolo` autonomous mode.** `opencode.json` gets `permission: { "*": "allow" }`
  (no `--auto` flag needed); orchestrator + qa `bash` become allow; role `edit` boundaries kept
  (SDK resolves most-specific-first). Verified live: headless run with zero permission prompts.
- [x] **Live validation: 5-phase dependency graph** ran end-to-end (dependency gating, collision-aware
  serialization, parallel qa∥adversary gate work, 5/5 tests). Recorded in `docs/validation.md`.

## Next — `armada new`: cookiecutter-inspired repo generator

Replace the stub `armada new` with a real cookiecutter-style generator, built from agentic-repo
best practices (the repo armada itself would want to scaffold). Cookiecutter is the reference for
template shape; we stay zero-dep (no cookiecutter dependency — the generator is native Node).

- [ ] **Agentic-repo template set** (`starter/<category>/`): each ships what a modern agent-driven
  repo needs — `AGENTS.md`, `README.md`, `LICENSE`, `.gitignore`, CI workflow, test bootstrap,
  `package.json`/`pyproject.toml`/etc, `devcontainer` (optional), and a `starter.yaml` metadata
  file (name, category, stack, defaults).
- [ ] **`armada new <name>` command**: category picker (web-app / cli-tool / api-service / ml-training /
  research-paper / library) + template selection, `{placeholder}` variable fill (project name,
  description, package manager, license, language).
- [ ] **Beginner vs experienced path**: beginner = curated defaults per category; experienced =
  drill-down questions (package manager, monorepo, auth, deploy target, CI).
- [ ] **Non-interactive**: `armada new my-app --type web-app --beginner|--yes`.
- [ ] **Post-scaffold handoff**: run `armada init` team flow into the fresh repo (the generated
  repo gets the armada team immediately).
- [ ] **Tests**: template render (no dangling placeholders), catalog integrity, CLI e2e
  (new repo → detectStack → team scaffolds).

## Next — validate in a real repo

- [x] **Self-dogfood: armada on armada** (2026-08-01) — scaffolded the team into a sandbox
  worktree, dispatched security + architect as background subagents, then uninstalled to a
  pristine repo. Results in `docs/validation.md`. The unified two-lane workflow (audit +
  feature) now lives in `docs/armada-improves-armada.md`.
- [ ] Run `armada init` in `~/WBG/data-ai-chatbot` (fastapi backend + nextjs frontend)
  - [ ] Confirm stack detection returns fastapi + nextjs
  - [ ] Confirm generated `.opencode/agent/*.md` native agents load in opencode (`opencode agent list`, TUI roster)
  - [ ] Confirm background orchestration works (`OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`)
  - [ ] Tune prompts against the real repo conventions (the data-ai-chatbot stack)
  - [ ] Verify `/armada` command shows the team
- [ ] File the results as a validation report in `docs/`

## Security & robustness

- [x] **`--cache <path>` arbitrary file write.** `validateCachePath` now rejects traversal,
  `~` expansion, and absolute paths outside `~/.armada` (relative filenames resolve under cwd).
  Wired into `refreshModels`; tested.
- [x] **`opencode.json` no-clobber + never leaks unscoped allows.** Verified: written only when
  absent; the generated config carries `external_directory: deny` (+ optional `yolo` catch-all),
  never unscoped `bash: allow`/`edit: allow`.

## Polish

- [x] Add `--dry-run` to `init` (print files without writing)
- [x] Add `--yes` / non-interactive defaults so `init` works without a TTY
- [ ] `renderCatalog` column widths — auto-size instead of hardcoded padding
- [ ] Better `questionnaire.js` — arrow-key selection instead of numbered prompts
- [ ] Add a `presets/` CLI command to apply a preset to the manifest (`armada preset power`)
- [ ] Emit a summary at end of init: models chosen, cost hint per tier, next steps

## Model catalog maintenance

- [ ] Re-verify every model ID against current opencode / OpenRouter availability before publish
  - `opencode-go/minimax-m3`, `opencode-go/deepseek-v4-pro`, `opencode/mimo-v2.5-free`,
    `opencode-go/deepseek-v4-pro`, `opencode/deepseek-v4-flash-free`, `opencode/big-pickle`,
    `opencode-go/hy3`, `opencode-go/deepseek-v4-flash`
  - OpenRouter fallbacks: `z-ai/glm-5.2`, `minimax/minimax-m3`, `xiaomi/mimo-v2.5`,
    `deepseek/deepseek-v4-pro`, `anthropic/claude-sonnet-4.6`
- [ ] Add a `(Recommended)` marker flag per model in the catalog (only the true first-choice
  model per budget tier should be tagged, not every option)
- [ ] Consider adding a `--list-openrouter` to `armada models` that shows the live model list
  from the OpenRouter API for pick-your-own workflows

## Design reviews to revisit

- [ ] Re-evaluate the 8-role roster against real multi-agent sessions. Are `docs` and
  `architect` earning their slot, or should they be opt-in-only?
- [ ] Revisit whether `security` should own a findings ledger (like DEFECTS.md /
  ADVERSARIAL_REVIEW.md) instead of inline reports.

## Deferred

- [ ] **Multi-harness support** (codex, claude code). Parked. When we tackle it, the generator grows per-harness renderers (`renderOpencodeAgent`, `renderCodexAgent`, `renderClaudeCodeAgent`) + an `--harness <name>` flag. Reference (OpenRouter cookbook): `codex-cli`, `opencode-integration`, `claude-code-integration`. The robust-opencode tiers make opencode the reference implementation; multi-harness layers on top without weakening it.
- [ ] **Worktree-per-task isolation** (firstmate's strongest idea — `git worktree` per parallel crewmate so edits can't collide). Aspirational. The prompt-contract "no blind stop" + fleet-status file are the lightweight substitutes. Revisit after the parallel-phase work settles.
