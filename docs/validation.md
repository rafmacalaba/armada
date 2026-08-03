# Validation Plan

Goal: prove opencode-armada works end-to-end in a real repo, then document the result.

> **Layout note:** armada is now native (no plugin). Generated teams are `.opencode/agent/*.md`
> files with a minimal `opencode.json` (`default_agent`, `external_directory: deny`). Entries
> dated 2026-08-01 below describe the earlier omo-slim plugin layout — they are historical
> records, not current behavior.

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
   - Confirm `.opencode/agent/<role>.md` native agent files are written for all 8 roles.

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
   - Any agent frontmatter schema drift
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

---

## Contract co-writing + per-feature requirements (2026-08-01)

Workflow improvement so the contract is co-written, not hand-authored:

1. **Orchestrator elicits the contract.** Prompt now: if the requirements file is blank, do NOT
   build — ask the user what they want (one question at a time), draft phases + success
   criteria, iterate to consensus, get explicit approval first.
2. **Per-feature contract files.** `armada init --requirements <file>` (e.g.
   `REQUIREMENTS-admin-dashboard.md`) — a second feature no longer replaces the first contract.
   `requirementsFile` round-trips through `armada.yaml`; no-clobber holds per file.
3. **Parallelism documented in the prompt.** Within a phase, independent tasks run as parallel
   background jobs (backend-dev ∥ frontend-dev after the API contract is fixed); phases are
   gated unless the contract marks one independent.

Verified: 68/68 tests (7 new: manifest parse default/custom, renderers reference custom file,
scaffold writes custom contract + no-clobber, orchestrator append prompt fills `{requirements_file}`
with no dangling placeholders, CLI e2e `init --requirements`).

Workflow consequence for features like `/admin`: tell the orchestrator your intent once; it
asks the scope/auth/pages questions, drafts `REQUIREMENTS-admin-dashboard.md`, you approve, then
it implements phase-by-phase (backend ∥ frontend within a phase, gated across phases).

---

## Usage story + parallel dependency-driven phases (2026-08-01)

- **Usage clarified in README**: armada is a one-time generator — `init` once, then use
  `opencode`; the orchestrator co-writes the contract and omo-slim runs the team. Nothing else
  is armada at runtime. Setup flags (`--headless`, `--requirements`, `--budget`) are step-1
  options only.
- **Phases are dependency-driven, not rigidly sequential.** REQUIREMENTS scaffold now declares
  `**Depends on:** <phase>` per phase; the orchestrator builds the dependency graph and starts
  every ready phase as parallel background jobs (backend-dev ∥ frontend-dev per phase).
  Independent phases progress in parallel; only an unmet dependency or failed success criterion
  blocks. Dropped the redundant standalone "Parallelism" prompt section — omo-slim already is
  the parallel engine.

71/71 tests (3 new: requirements scaffold depends-on, AGENTS gates dependency-driven,
orchestrator append prompt lean).

---

## Orchestrator architecture + unified workflow docs (2026-08-01)

- **Orchestrator keeps the omo-slim primary slot.** Armada no longer scaffolds a separate
  `armada-orchestrator` subagent. It keeps the agent named `orchestrator` (required for
  `mode: primary` + the background-job board, which omo-slim injects only into that name) and
  **appends** the armada delivery protocol via `orchestrator_append.md`. The TUI shows it as
  **armada-orchestrator** through a `displayName`; the internal name never changes. This is
  what keeps parallel phase dispatch working — the orchestrator holds the board and dispatches
  backend-dev/frontend-dev/qa directly.
- **Two-lane "armada improves armada" workflow.** `docs/self-dogfood.md` was folded into
  `docs/armada-improves-armada.md`: Lane A (recurring audit) + Lane B (feature implementation),
  both in `sandbox/<name>/` worktrees. `docs/using-armada.md` now covers building **or** auditing
  on any other repo.

74/74 tests.

---

## Native mode — omo-slim dependency removed (2026-08-02)

Generated teams are now fully native opencode agents (`.opencode/agent/*.md` + minimal
`opencode.json`); the omo-slim plugin is gone. Validated end-to-end:

- **Native independence:** with a clean HOME (zero global config/plugin), `opencode agent list`
  loads all 8 armada agents from `.opencode/agent/` — orchestrator primary, zero omo-slim
  agents. Regression test asserts generated artifacts never reference omo-slim.
- **CLI:** `armada new` (fresh repo) + `armada init` (existing repo) + `--from-armada` +
  `--budget free/power` all produce the native layout; `--budget` selects per-role models.
- **Runtime trivial tasks** (`opencode run --auto --agent orchestrator`): existing repo →
  orchestrator dispatched backend-dev as a background subagent, test written + run, pass,
  exit 0. Fresh repo → SDK boundary blocked the orchestrator's own edit, delegated, exit 0.
- **TUI** (tmux pty): boots directly into **Orchestrator · Hy3** (`default_agent`), tab
  agent-switcher works, `/armada` command registers + executes reading `.opencode/agent/`.
- **Validation-driven fixes:** `color: cyan` was invalid in opencode 1.18.11's agent schema
  (config failed to load) → `#00bcd4`; `--budget` only changed the project model, leaving agent
  frontmatter on balanced → now recomputes per-role models.

159/159 tests.

---

## Agent frontmatter — opencode 1.18.11 schema (2026-08-02)

- `color` must be `#rrggbb` or a theme token (`primary/secondary/accent/success/warning/error/
  info`) — a CSS color name like `cyan` invalidates the whole config. Armada emits `#00bcd4`
  for the orchestrator.
- There is **no `displayName`** in native agents; the orchestrator keeps its internal name and
  uses `color` for TUI distinction. `default_agent: "orchestrator"` in `opencode.json` boots the
  TUI straight into it.

---

## Multi-phase parallel contract + autonomous mode (2026-08-02)

Validated the core promise end-to-end: a 5-phase dependency graph where independent phases
dispatch their own subagents and only dependent phases wait.

### Scenario (temp repo, `--budget free`, `--stack node-express`)

`armada/REQUIREMENTS.md` with 5 phases over a small Node HTTP server:

- Phase 1 `/about` and Phase 2 `/admin` — **no dependencies** (both candidate for parallel)
- Phase 3 `/about/team` — depends on 1
- Phase 4 `/admin/settings` — depends on 2
- Phase 5 `/` home + full suite — depends on 1-4

### Results (`opencode run --agent orchestrator`)

- **Dependency gating correct.** Ready-set progressed exactly per the graph:
  `{P2,P3}` after P1, `{P3,P4}` after P2, `{P4}` after P3, then P5 after all four.
- **All 5 phases passed**, 5/5 tests on the final `src/pages.js`/`src/pages.test.js`.
- **Collision-aware orchestration (the key finding).** The contract made every phase write the
  *same* files, so the orchestrator serialized the writers on a reused backend-dev session:
  *"every phase writes the same two files... Parallel writers would lose updates, so I
  serialize writers on one reused backend-dev session."* Correct behavior — parallel writers on
  a shared file would clobber.
- **True parallel dispatch** for non-colliding work: the final gate work (qa e2e ∥ adversary
  pass) ran as parallel background subagents — *"non-overlapping write scopes, so parallel."*
  The adversary produced a real finding (ADV-001: uncaught TypeError on absolute-form request
  targets in `server.js`).
- **Autonomy.** Ran with `opencode run` (no `--auto`); only one shell approval was needed in the
  TUI mode (headless used none). This motivated `armada init --yolo`.

### Action taken from the findings

1. **`--yolo` autonomous mode** (`armada init --yolo` / `armada.yaml` `yolo: true`):
   - `opencode.json` gets `permission: { "*": "allow" }` (auto-approve; needs no `--auto` flag).
   - Orchestrator + qa `bash` become `allow` — no prompt stalls.
   - **Boundaries kept:** orchestrator `edit: { "*": "deny" }` stays (delegates writes);
     security/architect stay read-only. SDK resolves the most specific rule first.
   - Verified: headless `opencode run` on a yolo scaffold answered with zero permission prompts.
2. **Orchestrator prompt** gained an explicit **"Unlock parallelism — assign disjoint files"**
   rule: prefer per-phase file isolation so independent phases stay parallel; when a file must be
   shared, serialize writers on a reused session and say so.

### Tests

183 pass (was 178): yolo manifest round-trip, buildTeam yolo bash flip + boundary preservation,
renderOpenCodeJson yolo config-level allow, CLI `init --yolo` e2e, orchestrator prompt disjoint-files
rule.

---

## Phase 4 — Restart-proof reconcile (session-based armada)

**Date:** 2026-08-02
**Validated by:** qa (`e2e/validation.test.js`)
**Full suite:** 246/246 pass (243 unit + 3 e2e), 0 regressions

### Scenario A: mid-phase kill + reopen

Created feature "alpha" via `armada feature new alpha`. Verified `active.json` shape (feature,
phaseGraph, phases array). Simulated a kill by setting phase-1 status to `in_progress` with one
criterion evidenced (`tests/state.test.js`) and `nextAction` set. Ran `armada feature status` —
output confirmed `active feature: alpha` and `phase-1: in_progress`. Built the resume line
from active state: `resume: feature alpha, phase phase-1 (in_progress), evidence 1 in, next
action continue phase 1 implementation`. State fields survived the simulated kill/reopen with
no loss.

**Result: PASS** — `e2e/validation.test.js:75`

### Scenario B: multi-feature safety

Created "alpha" and "beta" in the same repo. Disjoint contract files (`armada/contracts/alpha.md`
vs `beta.md`), disjoint entry files (`features/alpha.json` vs `features/beta.json`), both present
in `features/index.json`. Mutated alpha to `in_progress` — beta remained `open`. Closed alpha
with evidence in its contract — alpha shipped, beta still open. History files
(`history/alpha.jsonl`, `history/beta.jsonl`) exist and are disjoint.

**Result: PASS** — `e2e/validation.test.js:136`

### Scenario C: state round-trip via API + CLI

Created "gamma" via `armada feature new gamma`. Read back via `armada feature status`. CLI
output fields match what was written. Raw `active.json` verified: feature=gamma, contract
contains gamma, phases show pending, evidence empty, nextAction empty, updatedAt set.

**Result: PASS** — `e2e/validation.test.js:214`

### How to reproduce

```bash
cd /Users/rafaelmacalaba/WBG/opencode-armada/sandbox/impl-session
node --test e2e/validation.test.js
node --test 'tests/*.test.js'
```

### Tests

246 pass (was 243): added 3 e2e validation tests (mid-phase resume, multi-feature disjoint,
state round-trip). All prior 243 stay green.

---

## Phase 5 — Restart-proof reconcile

**Date:** 2026-08-03
**Validated by:** bac-3 (post-implementation, `sandbox/reconcile`)
**Full suite:** tests: 264 pass, 0 fail | e2e: 5 pass, 0 fail

Engine (`src/reconcile.js`, 297 lines), CLI (`src/reconcile-cli.js`, 48 lines), unit tests
(`tests/reconcile.test.js`, 20 tests), e2e tests (`e2e/reconcile.test.js`, 5 scenarios),
and generator update (`src/generator.js:383-389`) all landed. Phases 1-2 per contract
(`armada/REQUIREMENTS.md:47-84`) are met. Reconcile is read-only — zero state writes.

### Scenario A: no active feature

Setup: empty state directory (no `armada/state/active.json`).
Command: `node src/cli.js reconcile --state-dir <tmp>/armada/state --repo <tmp>`

```
resume: no active feature
```

**Result: PASS** — exit 0, correct message.

### Scenario B: happy path with one passed phase

Setup: `armada/state/active.json` with feature `demo`, phase-1 `passed` (criterion c1 with
evidence `tests/smoke.test.js`), phase-2 `pending`. Evidence file exists and passes.
Contract has phase-1 criteria all ticked `[x]`.

```
resume: feature demo, phase phase-2 (pending), evidence 1 in, drift 0, next "E2E pass"
```

**Result: PASS** — exit 0, resume line names active feature, current phase, evidence count,
no drifts.

### Scenario C: drifted feature (evidence-missing)

Setup: same as Scenario B but evidence file `tests/deleted.test.js` does not exist on disk.

```
resume: feature demo, phase phase-1 (in_progress), evidence 1 in, drift 1, next continue to next phase
drifts (1):
  - [evidence-missing] phase phase-1, criterion c1: tests/deleted.test.js
```

**Result: PASS** — exit 2, drift `evidence-missing` reported with phase, criterion and ref.

### How to reproduce

```bash
cd sandbox/reconcile
node --test 'tests/reconcile.test.js'     # 20 tests, all pass
node --test 'e2e/reconcile.test.js'       # 5 scenarios, all pass
node src/cli.js reconcile                 # scenario A (if no active feature)
node src/cli.js reconcile --state-dir /tmp/test-state --repo /tmp/test-repo
```

---

## 2026-08-03 — resume-reachable live validation

**Goal:** prove the orchestrator in a generated repo (no armada source tree) can resume
from `armada/state/` on its own, using either the global `armada` binary or the in-tree
fallback.

**Target repo:** `~/WBG/data-ai-chatbot` (cloned to a temp dir to avoid mutating the live checkout).

### Steps run

1. Clone `~/WBG/data-ai-chatbot` to a temp dir `armada-live-val-XXXX`.
2. From the lane root, run `node src/cli.js init --from-armada armada/armada.yaml --target <clone>`
   to re-render `.opencode/`. The clone's previous init predated the new `armada-resume.md`
   command; the new init re-rendered it.
3. Verify the rendered `.opencode/commands/armada-resume.md` contains BOTH `armada reconcile`
   (primary) and `node src/cli.js reconcile` (fallback). Result: both present.
4. Set up a mid-phase state in the clone: feature `admin-dashboard`, phase 1 passed with
   evidence, phase 2 in_progress with one unticked criterion. Wrote `armada/state/active.json`,
   `armada/state/features/index.json`, and a contract at `armada/contracts/admin-dashboard.md`
   matching the engine's expected schema (`phaseGraph.phases[].criteria[]`).
5. Probe the global binary: `command -v armada` → not installed. The command body falls back
   to the in-tree path automatically (per its own text).
6. Run the fallback: `node src/cli.js reconcile --repo <clone> --state-dir <clone>/armada/state`.

### Output (verbatim, fallback path)

```
resume: feature admin-dashboard, phase phase-2 (in_progress), evidence 1 in, drift 0, next "Widget list endpoint"
```

Exit code: `0`.

### Outcomes

- **Resume line + drift list printed.** The single-line resume plus drift count came through
  cleanly from the generated repo with no armada source tree on disk.
- **No state loss.** Re-running the same command produces the same line (state is
  read-only, not mutated by reconcile).
- **Primary path would also work, with caveat.** The global `armada` binary is not installed
  on this machine. The `e2e/armada-resume-command.test.js` test proves the primary path
  independently using a fake binary on PATH (`makeBin` pattern). For a true end-to-end test
  of the primary path on this machine, install armada globally (`npm link` from this lane)
  and re-run; the command body needs no change.

### Why a clone, not the live repo

`~/WBG/data-ai-chatbot` is on `feat/admin-dashboard` with its own in-flight feature work.
`armada init` against the live checkout would write a new `.opencode/` over the current one
and would re-render state. Cloning isolates the validation and leaves the live repo
untouched. The clone has identical `armada.yaml` and `armada/REQUIREMENTS.md`, so the
re-init exercises the same generator path.

### Evidence files

- Test: `e2e/armada-resume-command.test.js` (1/1 pass, ~260ms)
- Unit suite: `node --test 'tests/*.test.js'` (313/313 pass)
- Resume command body: `.opencode/commands/armada-resume.md` (rendered in the clone)

### 2026-08-03 (re-run) — global binary now installed; primary path proven

After addressing ADV-022, the global `armada` binary is now installed via `npm link`
(`/opt/homebrew/bin/armada`, version v0.6.2). Re-running from the same clone now exercises
the *primary* path, not the fallback:

```
$ cd <clone>
$ armada reconcile
resume: feature admin-dashboard, phase phase-2 (in_progress), evidence 1 in, drift 0, next "Widget list endpoint"
$ echo $?
0
```

Same resume line, same exit code, no state loss. The command body now matches the rendered
output of the re-init (see `armada-resume.md` after the re-render — ADV-021 wording fix
applied: the fallback is now explicitly gated on `src/cli.js` existing in cwd, so a
generated-repo orchestrator that somehow loses the global binary will get a clear "missing
binary" report instead of a confusing `node: can't open 'src/cli.js'` error).

## Real-repo validation (feat/real-repo-validation, 2026-08-03)

### Scope

Goal: validate armada in a real repo (`~/WBG/data-ai-chatbot`, fastapi + nextjs) and
verify restart-proof resume there. The live target is external (`external_directory: deny`);
this lane validates what it can in the sandbox and hands the user exact commands for the
interactive parts. In-sandbox `evidence-target/` is a fresh facsimile of the live target's
stack (nextjs + python-fastapi + postgres + playwright), re-scaffolded with current armada.
Live target remains a user-side re-scaffold + manual walkthrough.

### What was validated (Phase 1, read-only)

- **Stack detection.** `detectStack(evidence-target/)` returns `nextjs + python-fastapi +
  postgres + playwright`. Matches `armada.yaml`.
- **Native agents.** 8 `.opencode/agent/*.md` files generated with valid frontmatter
  (mode/model/permission). Listing + frontmatter parse at
  `docs/validation-evidence/phase-1-native-agents.txt`.
- **`opencode.json`.** Minimal + valid: `model: opencode-go/minimax-m3`,
  `default_agent: orchestrator`, `permission.external_directory: deny`, yolo `{"*": "allow"}`.
  Captured at `docs/validation-evidence/phase-1-opencode-json.txt`.
- **Manifest round-trip.** `parseManifestYaml(evidence-target/armada/armada.yaml)` accepts
  it (8 team members, correct stack). Evidence at
  `docs/validation-evidence/phase-1-armada-roundtrip.txt`.
- **Stack detection (live target).** The live `~/WBG/data-ai-chatbot` re-scaffold is a
  user-side manual step (see `docs/validation-evidence/phase-2-manual-walkthrough.md`); the
  in-lane validation runs against the in-sandbox `evidence-target/` facsimile. The lane
  can read the live target's files (read-only, no writes): inspection of
  `opencode.json`, `armada/armada.yaml`, and `.opencode/agent/*.md` confirmed stack
  detection matches. Evidence at `docs/validation-evidence/phase-1-stack-detection.txt` and
  `docs/validation-evidence/phase-1-live-target-note.txt`.

### What armada-side fixed (Phase 1)

`src/reconcile.js:229` — guard against non-iterable `phase.criteria`. Surfaces when a
phase's `criteria` is missing/null (e.g., a partially-saved state). Fix: `const criteria =
Array.isArray(phase.criteria) ? phase.criteria : []`. Existing reconcile unit tests still
pass (313 green). No new test needed — guard is defensive; existing tests already cover the
iterable case.

### What was validated (Phase 2, restart-proof resume)

- **In-tree reconcile.** `armada reconcile` (fallback: `node src/cli.js reconcile`) against
  this lane's own `armada/state/` prints a resume line + drift count. Output:
  `resume: feature real-repo-validation, phase phase-2 (in_progress), evidence 0 in, drift 0`.
  Captured at `docs/validation-evidence/phase-2-in-tree-reconcile.out`.
- **Evidence-target reconcile.** Same command against a fresh fixture state with evidence
  produces: `resume: feature demo-feat, phase phase-1 (in_progress), evidence 1 in, drift 0`.
  Drift detection works: forced drift (deleted evidence file) → exit 2 + drift list.
  Captured at `docs/validation-evidence/phase-2-evidence-target-reconcile.out`.
- **Test suite.** `node --test 'tests/*.test.js'` — 313 tests green.
  `docs/validation-evidence/phase-2-tests-pass.txt`.
- **Manual walkthrough.** Exact commands for the user to run in `~/WBG/data-ai-chatbot`:
  pre-flight (global binary) → scratch feature → kill mid-phase → `armada reconcile` →
  resume → cleanup. Each step has expected output + a "what to check" line. Documented at
  `docs/validation-evidence/phase-2-manual-walkthrough.md`.

### Live target status

`~/WBG/data-ai-chatbot` was scaffolded with an older armada (omo-slim era). Re-scaffold
is a user-side manual step; commands documented in
`docs/validation-evidence/phase-2-manual-walkthrough.md`. The clone-based validation above
confirms the generated repo path works end-to-end; the live target needs the re-scaffold
step before the walkthrough.

### Resume walkthrough

See `docs/validation-evidence/phase-2-manual-walkthrough.md`. Pre-flight (global `armada` on
PATH) → re-scaffold → scratch feature → kill mid-phase → `armada reconcile` → resume →
cleanup. Each step has expected output + a "what to check" line.
