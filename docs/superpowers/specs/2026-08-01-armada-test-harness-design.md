# Armada Standalone Test Harness + Capability Hardening — Design

Date: 2026-08-01
Status: approved

## Goal

Prove opencode-armada works standalone (synthetic/fixture repos, no external repo like
data-ai-chatbot) and harden the real gaps it exposes: YAML parser, `doctor`, `models
--refresh`, `--dry-run`, `--yes`, `uninstall`.

## Scope decisions (confirmed)

1. Add `yaml` runtime dep (only new dep; questionnaire stays zero-dep).
2. `uninstall` keeps user-owned `AGENTS.md`/`opencode.json`/`REQUIREMENTS.md`; `--all` opt-in
   removes them.
3. Model cache at `~/.armada/models.cache.json`, per-user not per-repo.

## Components

### 1. Test harness (`tests/`)
- `tests/helpers.js` — temp-repo factory, fake-bin PATH builder, CLI spawner
  (`execFile(process.execPath, [src/cli.js, ...args])`).
- `tests/cli.test.js` — spawn CLI end-to-end: `ping`, `init --from-armada`, `--dry-run`
  writes nothing, `--yes` non-TTY, missing manifest exit 1, `models --refresh` via fake bin.
- `tests/manifest.test.js`, `tests/doctor.test.js`, `tests/models-refresh.test.js` — unit
  coverage for new modules.
- `tests/roundtrip.test.js` — init -> parse armada.yaml -> init -> identical file tree + contents.
- `tests/dogfood.test.js` — scaffold over copies of this repo's AGENTS.md/CLAUDE.md/opencode.json;
  assert no-clobber.
- `tests/fixtures/` + `tests/fixtures.test.js` — synthetic repo corpus for `detectStack`.

### 2. Real YAML parser
- `parseManifestYaml(text)` in `src/manifest.js` using `yaml` dep. Replaces regex
  `parseManifest` in cli.js. Strict: throws on invalid YAML / missing project / empty team.

### 3. Real `models --refresh`
- `refreshModels({cachePath, env})` spawns `opencode models`, parses `provider/model` lines,
  caches JSON. `loadModelsCache(cachePath)` reads cache. `renderCatalog(budget, availability)`
  prefixes `✓`/`✗`. OpenRouter fallback checking out of scope (needs key); `--cache <path>`
  flag for isolation.

### 4. Real `doctor`
- `runDoctor({configPath, env})` spawns `opencode --version` + `opencode providers list`,
  reads `plugin[]` from `~/.config/opencode/opencode.json`, checks
  `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS`, reports node version. Statuses pass/warn/fail;
  CLI exits 1 on any fail.

### 5. Polish
- `scaffold(manifest, stack, {dryRun})` computes + returns paths, writes nothing.
- `uninstall(manifest, {all})` removes armada.yaml + .opencode + .devcontainer; `--all` adds
  AGENTS.md/opencode.json/REQUIREMENTS.md.
- `init --yes` (or no TTY) uses default manifest + declarative flags, no questionnaire.

## Files touched
`package.json`, `src/manifest.js`, `src/cli.js`, `src/scaffold.js`, `src/model-catalog.js`,
`src/doctor.js` (new), `tests/*`, `docs/validation.md`, `TODO.md`, `README.md`, `CLAUDE.md`.

## Verification
`node --test 'tests/*.test.js'` all green (19 existing stay green, ~13 new). Manual smoke:
`help`, `models --refresh --cache /tmp/x.json`, `doctor`, `init --from-armada --dry-run`,
`uninstall`.
