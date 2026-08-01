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

---

## Next — validate in a real repo

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
  plugin[] entry in `~/.config/opencode/opencode.json`, `opencode auth list`, and
  `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS`; sets exit code on failure.
- [x] **Manifest parser is regex-based.** `parseManifest` in cli.js only understands the
  exact `renderManifestYaml` output. Replaced with a real YAML parser (`yaml` package, see
  `src/manifest.js`) with schema validation before users hand-edit manifests.
- [ ] **Ponytail compression integration** is a design note only (SPEC §2.5, README). If
  caveman-terse prompts prove insufficient, add a ponytail-based compression layer to prompt
  templates.
- [x] **No `uninstall` command.** Now removes armada-generated artifacts cleanly
  (`armada uninstall`, `--all` for generated user-facing files, `--dry-run`).
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
  - `opencode-go/minimax-m3`, `opencode-go/kimi-k2.7-code`, `opencode/mimo-v2.5-free`,
    `opencode/deepseek-v4-pro`, `opencode/deepseek-v4-flash-free`, `opencode/big-pickle`,
    `opencode/hy3-free`, `opencode-go/deepseek-v4-flash`
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
