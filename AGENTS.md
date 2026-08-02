# opencode-armada — Agent Rules

opencode-armada generates reproducible AI-engineer multi-agent teams for opencode, built on
oh-my-opencode-slim. This file is the rules for agents working ON armada itself. Not a session
journal — session progress lives in commits and PRs.

## Commands

- Test suite: `node --test 'tests/*.test.js'` — must stay green before committing
- CLI smoke: `node src/cli.js help`
- Scaffold a team into a repo: `node src/cli.js init --from-armada armada.yaml`

## Architecture

Module map + data flow in [ARCHITECTURE.md](./ARCHITECTURE.md). One-liners:

- `src/cli.js` — entry: init / models / doctor / uninstall / ping / help
- `src/manifest.js` — manifest schema, default playbook, YAML parser (`parseManifestYaml`)
- `src/model-catalog.js` — roles, curated model recommendations, budget tiers, table renderer, models cache
- `src/stack-detect.js` — stack detection from manifests + instruction files (recurses subdirs for monorepos)
- `src/questionnaire.js` — interactive setup (node readline, zero deps)
- `src/generator.js` — pure renderers (team, slim jsonc, opencode.json, AGENTS.md, REQUIREMENTS.md, armada.yaml)
- `src/scaffold.js` — file I/O, prompt filling, no-clobber, `uninstall`
- `src/doctor.js` — environment health checks (spawns opencode, reads plugin config)
- `agents/<role>/prompt.template.md` — per-role prompts with `{placeholders}`
- `presets/*.yaml` — budget presets (free / balanced / power)

## Conventions

- ESM everywhere; imports use explicit `.js` extensions. Node >= 20.
- `yaml` is the only runtime dependency. The questionnaire stays zero-dep.
- Generator is pure (zero I/O); scaffold owns I/O.
- Never clobber user files: `opencode.json`, `AGENTS.md`, `REQUIREMENTS.md` are written only if
  absent. `armada.yaml` and `.opencode/` are armada-owned, always rewritten.
- Prompt templates use `{placeholder}` syntax; a test asserts no dangling placeholders.
- Model IDs are `provider/model` (e.g. `opencode-go/minimax-m3`), never bare names.
- Agent prompts ship terse/caveman output contracts to reduce token burn.

## Testing

- `node --test 'tests/*.test.js'` — unit + CLI e2e.
- CLI e2e spawns the real CLI (`tests/helpers.js` `runCli`); fake `opencode` binaries are
  injected via PATH (`makeBin`).
- Round-trip: init → parse armada.yaml → init must produce identical output (guards the parser).
- Dogfood: scaffolding over this repo's instruction files must not clobber them.
- Fixture corpus under `tests/fixtures/` exercises stack detection.
- Keep the suite fast and deterministic; no network calls in tests.

## Working here

- TDD: write the failing test first, then implement.
- Roadmap and open work: [TODO.md](./TODO.md). Design decisions: [SPEC.md](./SPEC.md).

## Superpowers

Do NOT auto-invoke the `subagent-driven-development` (SDD) skill. Ask before using it.
Other superpowers skills (brainstorming, writing-plans, etc.) remain as-is.
