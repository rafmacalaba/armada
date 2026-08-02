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
- [x] Generator (pure): slim jsonc, opencode.json, AGENTS.md, REQUIREMENTS.md, armada.yaml
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

## Next — armada new: best-practice repo generator (experience-aware)

- [ ] `armada new [name]` command: category picker + experience gate
- [ ] Beginner path: curated state-of-the-art stack per category (`src/recommendations.js`) →
  generates an optimal repo scaffold (structure, manifests, CI, Dockerfile, devcontainer,
  README, LICENSE, test bootstrap)
- [ ] Experienced path: drill-down questions (per-layer stack, monorepo, auth, deploy target,
  CI) → customize
- [ ] `starter/<category>/` templates (reuse `{placeholder}` fill); then hand off to the
  existing `init` team flow
- [ ] Non-interactive: `armada new --type web-app --beginner|--yes`
- [ ] Tests: catalog integrity, template render, CLI e2e (new repo → detectStack → team scaffolds)
- [ ] Reconcile with the "no cookiecutter" gap — this is the built-in opinionated version of it

---

## Next — validate in a real repo

- [x] **Self-dogfood: armada on armada** (2026-08-01) — scaffolded the team into a sandbox
  worktree, dispatched security + architect as background subagents, then uninstalled to a
  pristine repo. Results in `docs/validation.md`. The unified two-lane workflow (audit +
  feature) now lives in `docs/armada-improves-armada.md`.
- [ ] Run `armada init` in `~/WBG/data-ai-chatbot` (fastapi backend + nextjs frontend)
  - [ ] Confirm stack detection returns fastapi + nextjs
  - [ ] Confirm generated `oh-my-opencode-slim.jsonc` loads in opencode (`opencode`, `ping all agents`)
  - [ ] Confirm background orchestration works (`OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`)
  - [ ] Tune prompts against the real repo conventions (the data-ai-chatbot stack)
  - [ ] Verify `/armada` command shows the team
- [ ] File the results as a validation report in `docs/`

## Known gaps

- [x] **`armada models --refresh` is a stub.** Now shells out to `opencode models` and merges
  live availability over the curated catalog, with a `--cache <path>` and ✓/✗ markers.
  Validation found catalog drift: `opencode/deepseek-v4-pro` unavailable, live equivalent is
  `opencode-go/deepseek-v4-pro`.
- [x] **`armada doctor` is a stub.** Now spawns real checks: `opencode --version`, the
  plugin[] entry in `~/.config/opencode/opencode.json`, `opencode providers list`, and
  `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS`; sets exit code on failure.
- [x] **Manifest parser is regex-based.** `parseManifest` in cli.js only understands the
  exact `renderManifestYaml` output. Replaced with a real YAML parser (`yaml` package, see
  `src/manifest.js`) with schema validation before users hand-edit manifests.
- [ ] **Ponytail compression integration** is a design note only (SPEC §2.5, README). If
  caveman-terse prompts prove insufficient, add a ponytail-based compression layer to prompt
  templates.
- [x] **No `uninstall` command.** Now removes armada-generated artifacts cleanly
  (`armada uninstall`, `--all` for generated user-facing files, `--dry-run`).
- [x] **Headless orchestration stalls on `ask` permissions.** Fixed via `armada init --headless`
  (`project.headless`): orchestrator bash becomes `allow` so non-interactive `opencode run`
  works. Validated end-to-end (orchestrator ran bash, dispatched architect inline, wrote
  findings). Note: **background**-job reconciliation still needs the live TUI; one-shot runs
  use inline subagent dispatch.
- [ ] **Per-role model overrides silently dropped.** `buildTeam` recomputes every role's model
  from `budget` and ignores `manifest.team[].model`, so questionnaire/`pickModel` overrides are
  lost on re-scaffold. Fix: honor manifest overrides, fall back to `modelFor` only when absent.
  (Found by armada's own architect during headless self-dogfood.)
- [ ] **`uninstall` requires an existing manifest.** If `armada.yaml` was deleted, `uninstall`
  errors instead of cleaning artifacts by their known paths. (Architect finding.)
- [ ] **`main()` returns `undefined`.** Programmatic callers can't distinguish success/error;
  return an exit-code int and let `isMain` set `process.exitCode`. (Architect finding.)
- [x] **Adversary catalog primary drift.** `opencode/deepseek-v4-pro` is unavailable on live
  providers; the working equivalent is `opencode-go/deepseek-v4-pro`. Swapped in CATALOG + balanced preset.
- [ ] **Path traversal via `requirementsFile`.** `src/scaffold.js:115-118` + `src/cli.js:182-185`
  + `src/manifest.js:34`. Untrusted manifest / `--requirements` value passes raw into
  `out(rel) = join(target, rel)`; `..` segments not sanitized. Supply-chain vector for cloned
  manifests. Fix: `resolve` + assert `abs.startsWith(resolve(target) + sep)`. (Security
  finding #1, AUDIT.md.)
- [ ] **Empty model `""` produces broken runtime config.** `src/manifest.js:19-24` accepts
  `team[].model: ""`; generator interpolates it. Provider lookup fails at runtime in a session
  the user can't easily diagnose. Reject empty / coerce to budget default. (Adversary ADV-002.)
- [ ] **`uninstall` orphans the custom contract file.** `src/scaffold.js:169-204`. Custom
  `requirementsFile` (from `--requirements`) is never removed on uninstall. Read manifest
  field, add to cleanup set. (Architect #2.)
- [ ] **No schema enforcement in `parseManifestYaml`.** `src/manifest.js:8-48`. `MANIFEST_SCHEMA`
  is a comment; accepts `name: 42`, `role: 123`, `budget: "ultra"`, unknown roles, etc.
  Enables BUGs #11, #12, #15, #16, #25. (Security #4 + architect improvement #1.)
- [ ] **`uninstall` deletes user-owned `.devcontainer/`.** `src/scaffold.js:196-199`.
  Unconditional recursive `rmSync` of `.devcontainer/`. Only remove armada-written files or
  require ownership marker. (Security #2.)
- [ ] **Generated `opencode.json` emits unscoped `bash: "allow"` + `edit: "allow"`.**
  `src/generator.js:168-176`. Grants the session agent unrestricted shell + edit whenever
  `opencode.json` is absent. Drop the top-level allows; rely on per-role roster + slim default.
  (Security #3.)
- [ ] **Filesystem errors leak full stack traces to users.** `src/cli.js:140-143,198,287`. Wrap
  I/O call sites; print `err.message` + one-line hint; reserve stack for `DEBUG=1`. (Architect
  #3 + adversary ADV-005.)
- [ ] **Duplicate role names in `team[]` silently dropped.** `src/manifest.js:19-24` +
  `buildTeam`. Detect duplicates at parse, reject or warn. (Adversary ADV-003.)
- [ ] **Raw string interpolation into generated JSONC/YAML.** `src/generator.js:148,151,353-359`.
  `project.name` / `requirementsFile` unquoted; `name` with `"` or newline corrupts generated
  `armada.yaml`, breaks round-trip. Quote YAML scalars; validate types. (Security #7.)
- [ ] **Stack instructions detected then dropped.** `src/stack-detect.js:169` collects
  `stack.instructions`; never rendered. Wire into orchestrator prompt or drop detection.
  (Architect improvement #2.)
- [ ] **`--headless` persists `bash: {"*": "allow"}` into versioned config.**
  `src/generator.js:102-108`. Scope the allow (`git*`/read) or document the post-CI revert.
- [ ] **`--cache <path>` arbitrary file write.** `src/cli.js:233-241` + `src/model-catalog.js:127-136`.
  Validate path stays under `~/.cache/` or target.
- [ ] **`enabled: 0` / `"no"` treated as true.** Strict boolean parse in `parseManifestYaml`.
- [ ] **`--from-armada --budget free` parses `budget` as manifest path.** Add `--` guard for
  value-as-flag. (Adversary ADV-007.)
- [ ] **`opencode.json` model ignores budget tier.** `src/generator.js`. Derive from
  `modelFor("orchestrator", budget)`. (Adversary ADV-008.)
- [ ] **Symlinks followed without warning.** `lstat` target dir; warn / reject on symlink.
- [ ] **No `--target <dir>` flag.** Target is hardcoded to `process.cwd()`. (Adversary ADV-010.)
- [ ] **`pickModel` variant choice is dead.** Same root as per-role override — fix together.
- [ ] **`questionnaire.js` non-injectable stdio.** `src/questionnaire.js:6`. Accept
  `{ input, output }` opts so tests can drive it inline.
- [ ] **`renderArmadaCommand` lives in `scaffold.js` (I/O module), not `generator.js` (pure).**
  Move string builder to generator.
- [ ] **`fillPrompt` mixes `readFileSync` with substitution.** Split pure `fillTemplate(text,
  manifest, stack)`.
- [ ] **`fallback` parsed then recomputed** in `buildTeam`. Honor parsed value (same fix as
  per-role model override).
- [ ] **`doctor` background-dispatch check is fake.** `src/doctor.js:51-56` returns
  `status: "pass"` unconditionally. Probe env + plugin; report real state.
- [ ] **`loadModelsCache` swallows every error → null.** `src/model-catalog.js:118-125`.
  Distinguish missing (legit) from corrupt (warn).
- [ ] **No cookiecutter compatibility.** Deliberate (see SPEC §3), but a thin `cookiecutter
  hook` adapter could be added later if users want the traditional scaffold UX.

## Polish

- [ ] `renderCatalog` column widths — auto-size instead of hardcoded padding
- [x] Add `--dry-run` to `init` (print files without writing)
- [x] Add `--yes` / non-interactive defaults so `init` works without a TTY
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
- [ ] Explore integrating `superpowers` SDD for non-orchestrated tasks (armada should stay
  lean; decide if it's worth bundling).
- [ ] Evaluate multiplexer integration (watch background agents live) as an optional opt-in.
- [ ] Confirm omo-slim's `permission` key semantics match what armada emits (edit globs,
  bash patterns) — update generated config if the plugin's schema changed.
