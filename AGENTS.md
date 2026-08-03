# opencode-armada — Agent Rules

opencode-armada generates reproducible AI-engineer multi-agent teams for opencode, natively —
no plugin. This file is the rules for agents working ON armada itself. Not a session
journal — session progress lives in commits and PRs.

## Commands

- Test suite: `node --test 'tests/*.test.js'` — must stay green before committing
- Smoke (live OpenRouter, opt-in, skipped without a credential): `npm run test:smoke`
- CLI smoke: `node src/cli.js help`
- Scaffold a team into a repo: `node src/cli.js init --from-armada armada.yaml`

## Architecture

Module map + data flow in [ARCHITECTURE.md](./ARCHITECTURE.md). One-liners:

- `src/cli.js` — entry: new / init / models / doctor / uninstall / ping / help
- `src/manifest.js` — manifest schema, default playbook, YAML parser (`parseManifestYaml`)
- `src/model-catalog.js` — roles, curated model recommendations, budget tiers, table renderer, models cache
- `src/stack-detect.js` — stack detection from manifests + instruction files (recurses subdirs for monorepos)
- `src/questionnaire.js` — interactive setup (node readline, zero deps)
- `src/generator.js` — pure renderers (team, native agent files, opencode.json, AGENTS.md, REQUIREMENTS.md, armada.yaml, commands, opt-in supervision plugin)
- `src/scaffold.js` — file I/O, prompt filling, no-clobber, `uninstall`
- `src/doctor.js` — environment health checks (spawns opencode, providers + openrouter auth, background dispatch, supervision-plugin presence)
- `src/new-command.js` + `starter/<category>/` — `armada new` repo generator
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
- Agents are native `.opencode/agent/<role>.md` files (frontmatter carries `mode`/`model`/
  `permission`); `opencode.json` stays minimal (`model` + `default_agent: "orchestrator"` +
  `permission.external_directory: deny`, plus `provider.openrouter` for model availability).
  No plugin is required.
- The core fleet model is **subagents + orchestrator, runnable in parallel**: orchestrator
  delegates writes, workers own their slice, independent phases run as background subagents,
  evidence-gated delivery. The orchestrator never ends its turn with background work
  outstanding, never writes code directly, and reads `.opencode/fleet-status.md` on session
  start (hard rules in `agents/orchestrator/prompt.template.md`).
- Opt-in supervision: `armada init --supervision-plugin` (or `armada.yaml`
  `supervision.plugin: true`) emits one `.opencode/plugins/armada-supervision.js` file
  (session.created resume nudge, session.idle no-blind-stop, tool.execute.before shell-redirect
  guard). Default init stays plugin-free.

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

## Environment notes

- The team is native opencode agents (`.opencode/agent/*.md`); no plugin is required.

## Superpowers

Do NOT auto-invoke the `subagent-driven-development` (SDD) skill. Ask before using it.
Other superpowers skills (brainstorming, writing-plans, etc.) remain as-is.
