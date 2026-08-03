# opencode-armada — TODO / Roadmap

Living backlog. Pick up the next item in the next session. Add new ideas at the bottom and
link them to an issue/PR when relevant.

---

## Backlog — prioritized

Open work, ordered by value. Pick up the top item in each band first. Sections further down
are history.

### Quick wins

Small, low-risk, high-leverage. Do first.

- [ ] **Mark restart-proof reconcile done.** PR #44 (`4b2c17b`) shipped the engine, CLI,
  `/armada-resume`, e2e. Update the ledger (done below) and confirm the generated-repo path —
  see the resume-reachability spec under High.
- [ ] **`armada models --list-openrouter`** — show the live model list from the OpenRouter API
  for pick-your-own workflows.
- [ ] **`(Recommended)` catalog marker** — flag only the true first-choice model per budget
  tier in `models` output, not every option.
- [ ] **Init end summary** — after `init`, emit models chosen, cost hint per tier, next steps.
- [ ] **`armada preset <name>`** — apply a preset to an existing manifest (`armada preset power`).
- [ ] **`renderCatalog` auto-size columns** — replace hardcoded padding with computed widths.

### High

The improvements that unlock the durable-implementation vision.

- [ ] **Skills integration** — spec below. Ships fleet skills into generated repos and lets
  every role consume them. (User priority: HIGH.)
- [ ] **Per-role configurability** — spec below. Manifest-level `permissions`, `instructions`,
  optional custom `prompt` per role. Closes the "are the prompts optimal?" gap.
- [ ] **Validate in a real repo — `~/WBG/data-ai-chatbot`** (fastapi + nextjs). Confirm stack
  detection, native agents load (`opencode agent list`), background orchestration
  (`OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`), tune prompts against real conventions,
  verify `/armada` shows the team. File results in `docs/validation.md`.
- [ ] **Restart-proof resume in a generated repo** — spec below. Make `/armada-resume` work
  outside armada's own source tree; then kill a session mid-feature in data-ai-chatbot and
  verify resume + no state loss.

### Medium

Bigger features, well-specified, sequenced after the High items.

- [ ] **`armada new` — cookiecutter-inspired repo generator.** Replace the stub. Template set
  `starter/<category>/` (AGENTS.md, README, LICENSE, .gitignore, CI, test bootstrap,
  package.json/pyproject.toml, optional devcontainer, `starter.yaml` metadata);
  `armada new <name>` with category picker (web-app / cli-tool / api-service / ml-training /
  research-paper / library) + `{placeholder}` fill; beginner (curated defaults) vs experienced
  (drill-down: package manager, monorepo, auth, deploy target, CI) paths; non-interactive
  `--type <cat> --beginner|--yes`; post-scaffold handoff (`armada init` team flow into the
  fresh repo); tests (template render with no dangling placeholders, catalog integrity, CLI
  e2e: new repo → detectStack → team scaffolds).
- [ ] **Multi-feature via worktrees.** `armada feature new <name>` optionally creates a
  `git worktree` per feature (`git worktree add sandbox/<feature>`, per-feature branch);
  `feature list` shows each worktree; zero cross-feature clobber; per-feature fast-forward
  merge. Upgrades the disjoint-files prompt rule (the fragile same-tree fallback). Test: two
  features in two worktrees, both implemented + merged, no clobber.
- [ ] **Arrow-key questionnaire** — readline arrow-key selection instead of numbered prompts.

### Low

Design re-evaluations, model hygiene. Not urgent.

- [ ] **Re-verify model IDs** against current opencode / OpenRouter availability before the next
  publish. Catalog: `opencode-go/minimax-m3`, `opencode-go/deepseek-v4-pro`,
  `opencode/mimo-v2.5-free`, `opencode/deepseek-v4-flash-free`, `opencode/big-pickle`,
  `opencode-go/hy3`, `opencode-go/deepseek-v4-flash`. OpenRouter fallbacks: `z-ai/glm-5.2`,
  `minimax/minimax-m3`, `xiaomi/mimo-v2.5`, `deepseek/deepseek-v4-pro`, `anthropic/claude-sonnet-4.6`.
- [ ] **Re-evaluate the 8-role roster** against real multi-agent sessions — do `docs` and
  `architect` earn their slot, or should they be opt-in-only?
- [ ] **Security findings ledger** — should `security` own a findings ledger (like DEFECTS.md /
  ADVERSARIAL_REVIEW.md) instead of inline reports?

### Deferred

- [ ] **Multi-harness support** (codex, claude code). When tackled: per-harness renderers
  (`renderOpencodeAgent` / `renderCodexAgent` / `renderClaudeCodeAgent`) + `--harness <name>`.
  Reference (OpenRouter cookbook): `codex-cli`, `opencode-integration`,
  `claude-code-integration`. The robust-opencode tiers make opencode the reference
  implementation; multi-harness layers on top without weakening it.

---

## Backlog specs — new improvements

### Skills integration (HIGH)

Armada ignores opencode's skill system: generated repos ship no `.opencode/skills/`, no prompt
mentions skills, no role sets `permission.skill`. All agents (incl. subagents) already get the
`skill` tool by default and can load skills on demand via `skill({name})`, so this is latent
capability waiting for wiring.

- [ ] **Starter skill set.** `src/skills/` ships 2–3 armada-specific SKILL.md files (each with
  valid `name` + `description` frontmatter), e.g. `armada-contract` (co-write / iterate a
  requirements contract one question at a time) and `armada-gate` (evidence-gate checklist:
  test run + screenshot per success criterion). Generator renders them into
  `.opencode/skills/<name>/SKILL.md`.
- [ ] **Manifest control.** `armada.yaml` gains `skills:` (list of skill names to ship; default
  ON with the starter set, off when the list is empty). Round-trips through
  `armada init --from-armada`.
- [ ] **Per-role `permission.skill`.** Explicitly set in `BASE_PERMISSIONS`: orchestrator +
  workers + qa `allow`; read-only roles (docs/architect/security) default (opencode enables all
  tools unless denied — only pin where we want `deny`/`ask`).
- [ ] **Prompts reference the skills.** Orchestrator prompt: "dispatch specialists with the fleet
  skill loaded when it applies (`armada-contract` for contract work, `armada-gate` when gating
  a phase)". Workers: read the SKILL.md when the task matches.
- [ ] **Tests.** Renderer emits valid SKILL.md (name matches `^[a-z0-9]+(-[a-z0-9]+)*$`,
  description present, no dangling placeholders); round-trip preserves `skills:`; generated
  agent frontmatter carries `permission.skill` where set; dogfood no-clobber still holds.

### Per-role configurability (HIGH)

The gap behind "are the prompts optimal?": prompt text is one fixed template per role,
permissions are hardcoded in `BASE_PERMISSIONS` (`src/generator.js:11`), and armada.yaml
serializes only role/model/fallback/enabled (`src/generator.js:503`).

- [ ] **Manifest fields.** `team:` entries gain optional:
  - `permissions:` — deep-merged over `BASE_PERMISSIONS[role]` (user rules win; e.g.
    `edit: { "scripts/*": "deny" }`, `bash: "deny"`)
  - `instructions:` — extra prompt text appended to the role's prompt (per-project
    conventions, e.g. backend-dev: "use FastAPI, keep handlers in src/")
  - `prompt:` — path to a custom `prompt.template.md` override (falls back to the bundled
    template)
- [ ] **Generator.** Merge in `buildTeam` (`structuredClone` base, apply overrides in order),
  render `permissions` into agent frontmatter, append `instructions` to the prompt body,
  resolve `prompt` path.
- [ ] **Round-trip.** armada.yaml serialization writes these fields back so
  `init --from-armada` is idempotent.
- [ ] **Tests.** Manifest schema accepts the fields; merge precedence (user > base); render
  includes them; round-trip equality; a fixture with a custom template.

### Restart-proof resume in a generated repo (HIGH)

`/armada-resume` runs `node src/cli.js reconcile` (`src/generator.js:388`) — that file only
exists inside armada's own source tree. A generated repo (e.g. data-ai-chatbot) has no
`src/cli.js`; the orchestrator there cannot resume from `armada/state/` on its own.

- [ ] **CLI reachability.** Make reconcile a subcommand of the installed/global `armada` binary
  (`armada reconcile`), callable from any armada-armed repo. `/armada-resume` command body uses
  `armada reconcile` (global) with `node src/cli.js reconcile` as the in-tree fallback.
- [ ] **Verify in a generated repo.** In `~/WBG/data-ai-chatbot`: init, open a feature, kill the
  session mid-phase, `armada reconcile` prints the resume line + drift list, resume completes,
  no state loss.
- [ ] **Tests.** CLI e2e with a fake `armada` binary on PATH (existing `makeBin` pattern);
  command renderer emits the new body; reconcile engine regression stays green.

---

## History — done

### v0.1 — done

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

### Contract co-writing — done

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

### Robust opencode harness (tiered) — done

The fleet model was hardened on opencode: **subagents + orchestrator, runnable in parallel** (armada's model; firstmate's pattern). Multi-harness (codex, claude code) is deferred — see "Deferred" in the backlog.

- [x] **Tier 1 — Model/provider robustness.** Generated `opencode.json` emits `provider.openrouter.models` for every openrouter slug the catalog uses (each with `options.provider.allow_fallbacks: true`). `armada doctor` adds an `openrouter auth` check with a remediation hint. Docs: power preset needs `OPENROUTER_API_KEY` / `/connect` openrouter.
- [x] **Tier 4 — Prompt contracts + regression tests** (shipped in the Tier 1 PR). Orchestrator prompt gained three hard rules: (a) no blind stop, (b) writes route through subagents, (c) read `.opencode/fleet-status.md` on session start. Tests assert the three rules + assert generated `opencode.json` has no `plugin` block by default.
- [x] **Tier 2 — Bundled skills (commands).** Added `/armada-status` (read fleet status), `/armada-scout` (read-only investigation dispatch), `/armada-resume` (pick up killed session). Shipped the `.opencode/fleet-status.md` schema. Generator renders the three command files; `uninstall` removes them.
- [x] **Tier 3 — Thin supervision plugin (opt-in).** Single `.opencode/plugins/armada-supervision.js`, opt-in via `armada init --supervision-plugin` or `armada.yaml` `supervision.plugin: true`. Three handlers: `session.created` → resume nudge from fleet-status, `session.idle` → no-blind-stop guard (with `skipNextIdle` recursion guard), `tool.execute.before` for `bash` → deny shell-redirect writes to files in the orchestrator's `permission.edit` deny set. Default `armada init` does NOT emit a plugin (the "no plugin" promise holds).
- [x] **Live OpenRouter smoke layer.** `tests/smoke/` (`npm run test:smoke`) — cheapest-model ping + catalog slug resolution; skipped cleanly without a credential.
- [x] **PR sequencing delivered:** PR 1 = T1 + T4, PR 2 = T2, PR 3 = T3 (each small, CI-gated, merged to master).

### Parallel phases + autonomous mode — done

- [x] **Orchestrator prompt: "Unlock parallelism — assign disjoint files."** Prefer per-phase file
  isolation (`src/<feature>.js` + its test) so independent phases run in parallel; when a file
  must be shared, serialize writers on a reused subagent session and say so.
- [x] **`armada init --yolo` autonomous mode.** `opencode.json` gets `permission: { "*": "allow" }`
  (no `--auto` flag needed); orchestrator + qa `bash` become allow; role `edit` boundaries kept
  (SDK resolves most-specific-first). Verified live: headless run with zero permission prompts.
- [x] **Live validation: 5-phase dependency graph** ran end-to-end (dependency gating, collision-aware
  serialization, parallel qa∥adversary gate work, 5/5 tests). Recorded in `docs/validation.md`.

### Security & robustness — done

- [x] **`--cache <path>` arbitrary file write.** `validateCachePath` now rejects traversal,
  `~` expansion, and absolute paths outside `~/.armada` (relative filenames resolve under cwd).
  Wired into `refreshModels`; tested.
- [x] **`opencode.json` no-clobber + never leaks unscoped allows.** Verified: written only when
  absent; the generated config carries `external_directory: deny` (+ optional `yolo` catch-all),
  never unscoped `bash: allow`/`edit: allow`.

### Session-based armada (per-feature contracts + on-disk state) — done

Armada owns a repo's *ongoing* implementation, not just one-shot feature runs. Each feature is a
separate implementation on the same armada-armed repo; the fleet is restart-proof, per-feature,
tracked by the orchestrator across sessions.

- [x] **State schema.** `armada/state/` layout shipped: `active.json` (feature + phase graph +
  evidence + next action), `features/` index, `history/` log. `src/state.js` (pure, zero-I/O) +
  validators.
- [x] **Per-feature contract CLI.** `armada feature new/list/close` shipped
  (`src/feature-commands.js`). `feature close` is evidence-gated (refuses without a passing
  criterion). `armada init --requirements <file>` wires the active feature.
- [x] **Orchestrator state read/write.** Prompt hard rules 3+4 read `armada/state/active.json` on
  session start + write state on every transition (never end a turn with unsaved state).
- [x] **Restart-proof reconcile.** Engine + CLI + `/armada-resume` + e2e shipped in PR #44
  (`4b2c17b`). On session start, the orchestrator diffs on-disk state vs repo reality (what
  shipped, what changed) and reports "resume: feature X phase 2, evidence in, next action Y".
  Residual gap: the CLI is only reachable inside armada's own source tree — see the
  resume-reachability spec under High.
- [ ] Multi-feature via worktrees — open, in Backlog → Medium.
- [ ] Live validation in a real repo — open, in Backlog → High.

#### Finding from the first Lane B run (2026-08-02)

The fleet implemented the session-based state feature end-to-end (~26m, $0.18, autonomous
`--yolo`) — but it edited its sandbox's **generated** `.opencode/agent/*.md` + command copies,
which are **gitignored**. The **tracked sources** (`agents/orchestrator/prompt.template.md`,
`src/generator.js` command renderers) kept the old fleet-status references, so the state
behavior would have been lost on re-scaffold. Fixed in `8e0fab3` (ported rules to sources +
fixed test portability).

**Lesson for self-improvement:** when armada improves itself, the contract must require edits to
the **tracked source templates** (e.g. `agents/**`, `src/**`), and the fleet should verify the
change survives `armada init --from-armada` (re-scaffold round-trip), not just the live
`.opencode/` config. Add a "verify via re-scaffold" gate to Lane B contracts that touch armada's
own generators/templates.

#### `--yolo` still co-writes

Autonomous mode auto-approves *permissions* — it does NOT skip the **contract co-write**. The
orchestrator still: reads the contract, and if phases/criteria are blank, elicits requirements
one question at a time, drafts, iterates to consensus, and gets explicit approval before
building. `--yolo` means no permission prompts for *tools*; the *product decision* (what to
build) is still co-authored with the user. Try it on the next feature: leave the contract blank,
launch `--yolo`, and let the orchestrator walk you through the requirements before it starts.

### Validate in a real repo — self-dogfood

- [x] **Self-dogfood: armada on armada** (2026-08-01) — scaffolded the team into a sandbox
  worktree, dispatched security + architect as background subagents, then uninstalled to a
  pristine repo. Results in `docs/validation.md`. The unified two-lane workflow (audit +
  feature) now lives in `docs/armada-improves-armada.md`.

### Polish — done

- [x] Add `--dry-run` to `init` (print files without writing)
- [x] Add `--yes` / non-interactive defaults so `init` works without a TTY
