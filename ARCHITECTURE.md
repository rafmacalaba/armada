# opencode-armada — Architecture

How the code is organized and how data flows. Read this before contributing.

---

## Module map

```
src/
├── cli.js              entry + subcommand dispatch (init / models / doctor / uninstall / ping / help)
├── index.js            library entry (programmatic API re-exports)
├── model-catalog.js    roles, curated model recommendations, budget tiers, table renderer, models cache
├── stack-detect.js     detect tech stack from manifest files + instruction files
├── questionnaire.js    interactive setup prompts (node readline, zero deps)
├── generator.js        pure renderers: team, slim jsonc, opencode.json, AGENTS.md,
│                       REQUIREMENTS.md, armada.yaml
├── scaffold.js         file I/O: writes generated files into a target repo, fills prompts,
│                       uninstall
├── doctor.js           environment health checks (spawns opencode, reads plugin config)
└── manifest.js         manifest schema, default playbook, YAML parser (parseManifestYaml)

agents/<role>/prompt.template.md   per-role system prompt with {placeholders}
presets/*.yaml                     budget presets (free / balanced / power)
template/.devcontainer/*           static devcontainer files copied on demand
```

---

## Data flow

```
user input (questionnaire / flags / armada.yaml)
        │
        ▼
  manifest object  { project: {name, budget, browserTesting, devcontainer,
  ─────────────────   useAgentBrowser, stack}, team: [{role, model, fallback, variant,
  │                   enabled}], playbook }
  │
  ▼
buildTeam(manifest)  ──────────────►  team[] (8 roles, model from budget, permissions,
  │                                     orchestratorPrompt routing)
  │
  ├── renderSlimJsonc(manifest, team)   → .opencode/oh-my-opencode-slim.jsonc
  ├── renderOpenCodeJson(manifest, team)→ opencode.json
  ├── renderAgentsMd(manifest, team)    → AGENTS.md
  ├── renderRequirementsMd(manifest)    → REQUIREMENTS.md
  ├── renderManifestYaml(manifest, team)→ armada.yaml
  └── fillPrompt(template, manifest, stack) → .opencode/oh-my-opencode-slim/<role>.md
        │
        ▼
scaffold(manifest, stack)  — writes all of the above into target repo
```

---

## Key invariants

1. **Generator is pure.** `generator.js` has zero I/O — everything is a function of the
   manifest + team. Testable and deterministic.
2. **Scaffold owns I/O.** `scaffold.js` writes files; it never makes decisions about content
   beyond "does this file already exist?" for the protected set.
3. **No clobber on user files.** `opencode.json`, `AGENTS.md`, `REQUIREMENTS.md` are written
   only if absent. `armada.yaml` and `.opencode/` artifacts are always (re)written — they're
   armada-owned.
4. **Placeholders.** Prompt templates use `{placeholder}` syntax. `fillPrompt` substitutes
   from the manifest stack. A test asserts no dangling placeholders survive.
5. **One runtime dep.** `yaml` (manifest parsing). Everything else is node built-ins
   (readline, fs, path, url). The questionnaire stays zero-dep. Everything runs with plain
   `node` or `bun`.

---

## Conventions

- **ESM everywhere.** `"type": "module"`; imports use explicit `.js` extensions.
- **Node-version compatible.** Targets node >= 20 (tests use `node:test`).
- **Caveman-terse prompts.** Agent prompts ship with terse output contracts to reduce token
  burn. Keep new agents consistent.
- **Model IDs are `provider/model`.** e.g. `opencode-go/minimax-m3`,
  `openrouter/z-ai/glm-5.2`. Never a bare model name.

---

## Adding a new role

1. Add a dir `agents/<role>/prompt.template.md` (with placeholders + output contract).
2. Add the role to `ROLES` and `CATALOG` in `src/model-catalog.js` (primary/fallback/free/power).
3. Add a default `permission` block + `ROUTING` in `src/generator.js`.
4. Add the prompt source path in `src/scaffold.js` (`PROMPT_SOURCE`).
5. Update `presets/*.yaml` and the README model table.
6. Extend `tests/` (catalog coverage + generated files).
7. Update SPEC.md team table + this file if layout changed.

---

## Testing

```bash
node --test 'tests/*.test.js'
```

Three suites:
- `tests/model-catalog.test.js` (catalog invariants — currently folded into generator tests)
- `tests/generator.test.js` — catalog coverage, budget logic, jsonc/opencode.json/AGENTS/manifest rendering, stack detection
- `tests/scaffold.test.js` — prompt filling, file emission, no-clobber behavior
- `tests/stack-detect.test.js` — stack detection cases

Run e2e manually:

```bash
mkdir -p /tmp/armada-e2e && cd /tmp/armada-e2e
# create package.json + armada.yaml, then:
node /path/to/opencode-armada/src/cli.js init --from-armada armada.yaml
```
