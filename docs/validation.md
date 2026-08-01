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
- **Result: 52/52 tests pass** (`node --test 'tests/*.test.js'`).

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

---

## Self-dogfood: armada on armada (2026-08-01)

Ran armada against its own repo as a full self-use smoke test, then restored the repo to a
pristine state.

### Setup

- Installed the runtime engine: `npx oh-my-opencode-slim@latest install --preset=opencode-go`
  (bun is not installed on this machine; npx worked). `armada doctor` now reports
  `omo-slim plugin: pass`.
- Scaffolded the team into this repo: `node src/cli.js init --yes --budget balanced`.
  - Wrote `.opencode/` (slim jsonc + 8 role prompts + `/armada` command), `armada.yaml`,
    `opencode.json`, `REQUIREMENTS.md`.
  - **`AGENTS.md` was untouched** (no-clobber held).

### Runtime smoke

- Roster loads: `opencode run` read `.opencode/oh-my-opencode-slim.jsonc` and listed all 8
  agents (orchestrator, backend/frontend-dev, qa, adversary, security, docs, architect).
- Orchestration: the orchestrator dispatched **security + architect as parallel background
  subagents** to review `src/cli.js`; both spawned and completed (`✓`). Role permission
  boundaries held at runtime — security/architect are read-only, so they report in-context
  rather than writing files.

### Real findings (armada improving armada)

1. **Non-interactive `opencode run` stalls on `ask`-level permissions.** The orchestrator's
   `bash: { "*": "ask", ... }` (and edit restrictions) are auto-rejected outside the TUI, so
   in headless mode the orchestrator can't run `ls`/`wc`/`mkdir` to reconcile. armada's
   permission model assumes an interactive session with a human approving asks.
   → TODO: document this, or add a `--headless` preset that loosens orchestrator bash.
2. **Read-only reviewers can't persist findings.** security/architect `edit: { "*": "deny" }`
   by design → their findings live only in the subagent response. Fine in the TUI (orchestrator
   relays), a gap for automated pipelines.
3. **Generated `opencode.json` sets `external_directory: deny`**, so agents can't write to
   `/tmp`. Expected (sandboxing), but worth knowing when scripting cross-repo workflows.
4. **Catalog drift confirmed live**: adversary primary `opencode/deepseek-v4-pro` is ✗ on this
   provider; `opencode-go/deepseek-v4-pro` is the live equivalent (see harness finding #3).

### Cleanup

- `node src/cli.js uninstall` removed `armada.yaml` + all armada-owned `.opencode/` files and
  kept `.opencode/` when a non-armada file was present (the review-hardened mixed-dir path).
- Removed the session-created `opencode.json` + `REQUIREMENTS.md` manually (`--all` would have
  wrongly deleted `AGENTS.md`).
- **Repo restored**: `git status` clean, `node --test 'tests/*.test.js'` 52/52.

### Verdict

Self-hosting works end-to-end at the config + dispatch level. Live multi-agent orchestration
(approving asks, watching background jobs) requires the interactive TUI, which is the intended
usage. Headless orchestration is the main open gap → TODO.

---

## Headless self-dogfood: fix + one-shot run (2026-08-01)

Closed the headless gap from the previous run.

### Fix

New `armada init --headless` (manifest field `project.headless`, default false). When set, the
orchestrator's generated bash permission becomes `{ "*": "allow" }` instead of
`{ "*": "ask", "git status*": ... }`. Non-interactive `opencode run` auto-rejects `ask`
prompts, which is what stalled the orchestrator before. Other role boundaries unchanged
(read-only security/architect stay read-only). 6 new tests (58/58 total).

### Headless one-shot run (armada on armada)

`armada init --yes --headless --budget balanced`, then
`opencode run "git status --short; wc -l src/cli.js; ls src; dispatch architect inline; write
top 3 findings to smoke-findings.md"`:

- ✅ Orchestrator ran `git status`, `ls`, `wc` headlessly — previously auto-rejected.
- ✅ Dispatched architect as a subagent; result returned inline; orchestrator reconciled and
  wrote `smoke-findings.md`.
- 📝 **Background** subagent results resolve after the one-shot turn ends
  (`backgroundJobs.continueOnIdle: false`), so one-shot runs use inline dispatch; the live TUI
  still handles background reconciliation.

### Findings the architect filed (armada improving armada)

1. `buildTeam` recomputes models from the budget and **drops per-role overrides** the
   questionnaire collects (`manifest.team[].model` is parsed but ignored) → TODO.
2. `uninstall` requires an existing manifest; a user who deleted `armada.yaml` can't clean
   artifacts → TODO.
3. `main()` returns `undefined`; programmatic callers can't distinguish success/error → TODO.

### Cleanup

`uninstall` + manual `rm opencode.json REQUIREMENTS.md smoke-findings.md` → repo pristine,
`git status` clean, `node --test 'tests/*.test.js'` 58/58.

---

## Sandboxed real-repo validation + monorepo detection fix (2026-08-01)

Tested armada on real repos **without touching them** — each cloned to `/tmp/armada-sandbox/`,
scaffolded, verified, then deleted.

### data-ai-chatbot (fastapi backend + nextjs frontend, split subdirs)

- `armada init --yes --budget balanced` → exit 0, 14 files scaffolded, round-trip clean,
  jsonc valid, 8 agents, no dangling placeholders.
- **Gap exposed:** detection saw only `postgres` (from `docker-compose.yml`). `detectStack` was
  root-only and missed `backend/pyproject.toml` + `frontend/package.json` → generic prompts.
  `--stack fastapi-nextjs` hint worked around it, but auto-detection failed on a monorepo.

### data360-mcp (python fastapi mcp server)

- `armada init` → exit 0. Detected `backend: python-fastapi | testing: pytest | lang:
  typescript,python` (root `package.json` + `pyproject.toml`). ✅ no gap.

### Fix: monorepo stack detection

`detectStack` now aggregates manifests up to **two levels** into common code subdirs
(`backend/`, `frontend/`, `apps/`, `packages/`, ...), skipping `node_modules/` + hidden dirs.
Root files still win for exact placement; subdir manifests fill in the missing fields.
`srcDirs`/`languages` dedup across the tree. 5 new tests (61/61 total) + a `monorepo` fixture.

Re-run against the real repos:

| Repo | Before | After |
|---|---|---|
| data-ai-chatbot | `postgres` only | `frontend: nextjs \| backend: python-fastapi \| db: postgres \| testing: playwright \| lang: typescript,python`, srcDirs `backend`,`frontend` |
| data360-mcp | `python-fastapi + pytest` | `python-fastapi`, testing now `vitest` (recursion surfaced TS test deps — aggregate first-match heuristic) |

Note: `testing` picks the first match across the whole tree (`playwright > vitest > jest >
pytest > cypress`). For a mixed TS+Python repo the winner may be either; acceptable aggregate
heuristic, revisit if a repo needs per-language test framework.
