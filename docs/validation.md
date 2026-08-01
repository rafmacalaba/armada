# Validation Plan

Goal: prove opencode-armada works end-to-end in a real repo, then document the result.

## Target repo

`~/WBG/data-ai-chatbot` — Python FastAPI backend + React/Next.js frontend.

## Steps

1. **Stack detection**
   ```bash
   cd ~/WBG/data-ai-chatbot
   node ~/WBG/opencode-armada/src/cli.js init --from-armada <manifest>
   ```
   First confirm `detectStack` returns `python-fastapi` + `nextjs`. The repo has
   `backend/`, `frontend/`, `docker-compose.yml`, `requirements.txt` — good candidates.

2. **Scaffold** (dry-run first once `--dry-run` exists, else real)
   - Confirm `opencode.json`, `AGENTS.md`, `REQUIREMENTS.md` are NOT overwritten (they don't
     exist yet, so they'll be created).
   - Confirm `.opencode/oh-my-opencode-slim.jsonc` + prompt files are written.

3. **Load in opencode**
   - `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true opencode`
   - `/armada` → team status
   - `ping all agents` → all 8 roles respond

4. **Real build smoke test**
   - Give the orchestrator a bounded task (e.g. "add one endpoint + one page"), watch it
     dispatch background specialists, reconcile, verify.

5. **Record findings**
   - Model ID availability on the user's actual providers
   - Prompt quality against the repo conventions
   - Any omo-slim schema drift
   - Update TODO.md and close the "Next" section when done.

## Result

Append the outcome (pass/fail + notes) to this file when the validation runs.

---

## Standalone harness results (2026-08-01)

The real-repo validation above is still open (needs `~/WBG/data-ai-chatbot`). Meanwhile a
**standalone test harness** was built in `tests/` so the CLI is exercised without touching a
real repo:

- **CLI e2e suite** (`tests/cli.test.js`) — spawns the real `src/cli.js` via `node` in a temp
  repo: `ping`, `init --from-armada`, `init --dry-run`, `init --yes --budget --no-browser`,
  missing-manifest exit 1, `models --refresh` against a fake `opencode` in PATH, and the new
  `uninstall` / `--all` / `--dry-run` / missing-manifest cases.
- **Round-trip** (`tests/roundtrip.test.js`) — `init --from-armada` output parses back to an
  identical manifest (`init -> parse -> init` is stable).
- **Dogfood no-clobber** (`tests/dogfood.test.js`) — re-running `init` never overwrites user
  `opencode.json` / `AGENTS.md`.
- **Fixture corpus** (`tests/fixtures/`) — real-world manifests feed `buildTeam` +
  `parseManifestYaml`.
- **Result: 46/46 tests pass** (`node --test 'tests/*.test.js'`).

### Real findings the harness caught

1. **`buildTeam` ignored `manifest.project.budget` / `browserTesting`.** Declarative flags
   `--budget` / `--no-browser` were silently ignored — round-trip test exposed the mismatch.
   Fixed (`buildTeam` now reads both fields off the manifest).
2. **`formatStack` crashed on an empty stack.** `init --yes` on a bare repo blew up. Fixed
   (empty-stack path returns a minimal summary).
3. **Live `models --refresh` shows catalog drift.** Against real provider lists, adversary
   primary `opencode/deepseek-v4-pro` is unavailable; the live equivalent is
   `opencode-go/deepseek-v4-pro`. `models --refresh` (with `--cache`) validated the feature and
   surfaced the drift — candidate fix: swap the adversary catalog primary.

### Manual smoke (2026-08-01, this machine)

| Command | Result |
|---|---|
| `node src/cli.js help` | shows `uninstall [--all] [--dry-run]` in usage |
| `node src/cli.js models --refresh --cache /tmp/armada-cache.json` | ✓/✗ markers per model, exit 0; adversary `opencode/deepseek-v4-pro` shows ✗ |
| `node src/cli.js doctor` | real per-check output (opencode 1.18.11 pass, providers pass, omo-slim plugin fail — expected, background subagents warn); exit 1 |
| scratch: `init --yes --budget free --no-browser` then `uninstall` | init scaffolds 14 files; `uninstall` removes `armada.yaml` + `.opencode`, keeps `AGENTS.md`/`REQUIREMENTS.md`/`opencode.json`; exit 0 |
| scratch: `uninstall --dry-run` | prints `(dry-run) - <file>` lines, removes nothing (covered by `tests/cli.test.js`) |
