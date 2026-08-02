# AUDIT — armada on armada (2026-08-01)

Lane A (read-only audit). Inputs: security, architect, adversary, qa in parallel.
Suite state at audit start: 75/75 pass, 1.4s, deterministic. No code changed.

Severity uses **IMPACT** (what breaks / what leaks), not effort.

---

## BUGS

### HIGH

1. **Path traversal via `requirementsFile`.** `src/scaffold.js:115-118` + `src/cli.js:182-185` +
   `src/manifest.js:34`. `requirementsFile` from untrusted manifest or `--requirements` flag
   passes raw into `out(rel) = join(target, rel)`; `mkdirSync({recursive})` + `writeFileSync`
   follow it. A `requirementsFile: ../../../../tmp/pwn` value writes outside the target repo.
   Content partly attacker-controlled (`project.name` rendered into the contract file).
   **Supply-chain vector** for any cloned manifest.
   Fix: `resolve` then assert `abs.startsWith(resolve(target) + sep)`. Reject `..`, absolute
   paths, non-strings.

2. **`buildTeam` drops per-role model overrides.** `src/generator.js:111`. `buildTeam` always
   sets `model: modelFor(role, budget)` and ignores `manifest.team[].model`. Affects *first*
   scaffold too — questionnaire.js:116 sets the override, buildTeam discards it. Round-trip
   test never exercises the path (it only feeds budget-derived models).
   Variant dies the same way (`buildTeam` recomputes it from CATALOG).
   **TODO-confirmed still open.** Fix: honor `manifest.team[].model` + `variant`, fall back to
   `modelFor` / CATALOG only when absent.

3. **Empty model `""` produces broken runtime config.** `src/manifest.js:19-24` accepts
   `team[].model: ""`; generator interpolates it into the slim jsonc `model` field. An agent
   with `model: ""` fails at provider lookup time, in a session the user can't easily diagnose.
   Fix: reject `model` that isn't a non-empty string, or coerce to the budget default at
   parse time.

### MEDIUM

4. **`uninstall` orphans the custom contract file.** `src/scaffold.js:169-204`. Custom
   `requirementsFile` (e.g. `REQUIREMENTS-dashboard.md` from `--requirements`) is never removed
   on uninstall — only the default `REQUIREMENTS.md` is. Two-`uninstall` calls leave the
   custom file behind.
   Fix: read `manifest.project.requirementsFile`, add to cleanup set.

5. **`uninstall` requires an existing manifest.** `src/cli.js:271-275` (architect) + adversary
   ADV-006. Repro: `rm armada.yaml; armada uninstall` → exit 1, artifacts untouched.
   `tests/cli.test.js:110` locks this in.
   **TODO-confirmed still open.** Fix: when manifest missing, clean by known paths
   (`.opencode/`, `armada.yaml`, generated `opencode.json`/`AGENTS.md`/`REQUIREMENTS.md`).

6. **`main()` returns undefined on the unknown-command branch.** `src/cli.js:113-117` (architect
   #5). `init`/`models`/`doctor`/`uninstall` now return their handlers' results, but
   `default:` falls through after `process.exitCode = 1`. Programmatic callers see
   `undefined`, not a non-zero code.
   **TODO partially open.** Fix: return `process.exitCode ?? 0` from every branch, or return
   `1` from `default:` explicitly.

7. **No schema enforcement in `parseManifestYaml`.** `src/manifest.js:8-48` exports
   `MANIFEST_SCHEMA` as a comment; nothing validates against it. Accepted today: `name: 42`,
   `role: 123`, `requirementsFile: [a,b]`, `budget: "ultra"`, `stack: "string"`, unknown role
   names. Bad data lands in the YAML round-trip and partially drives downstream.
   Fix: implement the schema (jsonschema, or hand-rolled type checks); reject on violation.

8. **`uninstall` deletes user-owned `.devcontainer/`.** `src/scaffold.js:196-199`. Recursive
   `rmSync` of `.devcontainer/` when the dir exists, regardless of who created it. Scaffold
   only writes devcontainer when `manifest.project.devcontainer` is true — user could have
   their own.
   Fix: only remove armada-written files, or require an ownership marker.

9. **Generated `opencode.json` emits unscoped `bash: "allow"` + `edit: "allow"`.**
   `src/generator.js:168-176`. Whenever `opencode.json` is absent, armada writes one that
   grants the session agent unrestricted shell + edit. Contradicts the "role boundaries
   enforced by permissions" claim and the rest of the role roster which uses narrow
   permission patterns.
   Fix: drop the top-level `bash: "allow"` / `edit: "allow"` (let the slim default or the
   per-role roster carry the policy); keep `external_directory: "deny"`.

10. **Filesystem errors leak full stack traces.** `src/cli.js:140-143,198,287` (architect #3) +
    adversary ADV-005. `mkdir`/`write`/`rm` `EACCES`/`ENOSPC` reach the `isMain` catch which
    does `console.error(err)` — the user sees a stack, not "check permissions on `<path>`".
    Fix: wrap the I/O call sites; print `err.message` + a one-line hint; reserve stack for
    `DEBUG=1`.

11. **Duplicate role names in `team[]` silently dropped.** `src/manifest.js:19-24` parses
    duplicates as-is; `buildTeam` keys by role, so the second wins and the first disappears
    with no warning. User can be confused why their tuning vanished.
    Fix: detect duplicates at parse time, reject or warn.

12. **Raw string interpolation into generated JSONC/YAML.** `src/generator.js:148,151,353-359`
    (security #7). `project.name` and `requirementsFile` are unquoted when emitted to
    `armada.yaml`; a `name` containing `"` or a newline corrupts the generated file and
    breaks the round-trip. Not code exec (output is data), but corrupts the project config.
    Fix: quote YAML scalars (`JSON.stringify` for the value side), validate types before
    render.

13. **Stack instructions detected then dropped.** `src/stack-detect.js:169` collects
    `stack.instructions`; `src/generator.js:360-366` never references it. Round-trip
    `init → parse → init` silently loses the field. `formatStack` and `fillPrompt` ignore it.
    Fix: either render it (e.g. into the orchestrator prompt) or drop the detection.

### LOW

14. **`--headless` persists `bash: {"*": "allow"}` into versioned config.** `src/generator.js:102-108`.
    A CI flag survives into the repo's checked-in `armada.yaml`; subsequent sessions re-emit
    the unscoped allow. Fix: scope the headless allow (`git*`/read), or document the
    post-CI revert.
15. **`--cache <path>` is an arbitrary file write.** `src/cli.js:233-241` +
    `src/model-catalog.js:127-136`. `mkdirSync(dirname, {recursive})` + `writeFileSync` on a
    user-supplied path with no containment. Self-inflicted in normal use, same class as #1.
    Fix: validate the path stays under `~/.cache/` or the target.
16. **`enabled: 0` (or `"no"`) treated as true.** Adversary ADV-004. Loose-truthy parse.
    Fix: strict boolean parse.
17. **`--from-armada` missing `--` guard.** Adversary ADV-007. `--from-armada --budget free`
    parses `budget` as the manifest path. Fix: detect flag value starts with `--`.
18. **`opencode.json` model ignores budget tier.** Adversary ADV-008. Top-level `model` in
    generated `opencode.json` is hardcoded; doesn't follow `manifest.project.budget`.
    Fix: derive from `modelFor("orchestrator", budget)`.
19. **Symlinks followed without warning.** Adversary ADV-009. `.opencode/` as a symlink
    would have writes follow it (could escape the repo). Fix: `lstat` + warn/reject on
    symlink at the target dir.
20. **No `--target <dir>` flag.** Adversary ADV-010. Target is hardcoded to `process.cwd()`.
    Fix: optional `--target` with path validation.
21. **`pickModel` variant choice is dead.** `src/questionnaire.js:57-69` +
    `src/generator.js:113`. The power-model "thinking" variant is collected and discarded by
    `buildTeam`. Same root as #2.
22. **`questionnaire.js` non-injectable stdio.** `src/questionnaire.js:6`. Module-level
    `import {stdin, stdout}`; `runQuestionnaire(rootDir)` is the only knob. Test path =
    `child_process` spawn. Fix: accept `{ input, output }` opts.
23. **`renderArmadaCommand` lives in `scaffold.js` (I/O module), not `generator.js` (pure).**
    `src/scaffold.js:209-216`. String builder doesn't touch disk; should be testable.
    Fix: move to generator.
24. **`fillPrompt` mixes `readFileSync` with substitution.** `src/scaffold.js:22-39`.
    Substitution is the testable part; the file read is incidental. Fix: split pure
    `fillTemplate(text, manifest, stack)`.
25. **`fallback` is parsed then recomputed.** `src/manifest.js:22` + `src/generator.js:112`.
    The user-set fallback is overwritten by `fallbackFor` in `buildTeam`. Same root as #2.
26. **`doctor` background-dispatch check is fake.** `src/doctor.js:51-56`. Returns
    `status: "pass"` unconditionally — no env probe, no plugin check. Green signal, zero
    info. Fix: probe `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS` and the omo-slim plugin
    entry; report the real state.
27. **`loadModelsCache` swallows every error → null.** `src/model-catalog.js:118-125`. Corrupt
    cache = silent no-markers. Fix: distinguish missing (legit) from corrupt (warn).

---

## IMPROVEMENTS (no bug, but worth doing)

- `MANIFEST_SCHEMA` is referenced from `src/manifest.js:50-64` but never enforced — schema
  doc drifts from behavior. (Already covered as BUG #7 — fix the doc or delete it.)
- `ROUTING` (`src/generator.js:78-94`) hand-duplicates content from `CATALOG[].reasoning`
  (`src/model-catalog.js:40-96`). Two sources of truth; catalog drift already bit this repo
  (commit `6b30e2a`). Derive or delete one.
- `index.js` re-exports the public surface but `scaffold` is the only export; no typed
  contract for the programmatic entry. (`scaffold(manifest, stack, opts)` accepts any object;
  NPEs on missing `team` / `project`.)
- Render a summary at end of `init` — models chosen, cost hint per tier, next steps. (Already
  in TODO under "Polish".)
- `renderCatalog` column widths are hardcoded padding — auto-size. (Already in TODO under
  "Polish".)
- Arrow-key selection in `questionnaire.js` instead of numbered prompts. (Already in TODO
  under "Polish".)

---

## TEST GAPS (qa)

Suite is 75/75 green and deterministic (no network, no real `opencode` binary, all spawns
use `makeBin` PATH injection). 17 coverage gaps, all small branches:

| # | Path:line | Untested |
|---|-----------|----------|
| 1 | `src/cli.js:107-111` | `help` / `-h` / `--help` / no-args path |
| 2 | `src/cli.js:113-117` | unknown command default branch |
| 3 | `src/cli.js:157-163` | `init --from-armada` with bad YAML |
| 4 | `src/cli.js:231-254` | `models` without `--refresh`, no cache |
| 5 | `src/cli.js:241-245` | `models --refresh` spawn failure |
| 6 | `src/manifest.js:15` | missing `project` section rejection |
| 7 | `src/model-catalog.js:103-104` | `modelFor` unknown role throw |
| 8 | `src/model-catalog.js:110-112` | `fallbackFor` happy path |
| 9 | `src/model-catalog.js:118-125` | `loadModelsCache` non-array `models` |
| 10 | `src/model-catalog.js:140` | `renderCatalog` no availability markers |
| 11 | `src/stack-detect.js:38-44` | `manifestDirs` skips non-dir entries |
| 12 | `src/stack-detect.js:111-113` | `@nestjs/core` backend detection |
| 13 | `src/stack-detect.js:140-148` | DB inference from `.env` `DATABASE_URL` |
| 14 | `src/scaffold.js:24-27` | `fillPrompt` with `useAgentBrowser: true` |
| 15 | `src/generator.js:100` | `buildTeam` disabled role |
| 16 | `src/generator.js:116` | `buildTeam` browser false path |
| 17 | `src/doctor.js:39-47` | JSONC comment-stripping regex path |

**Quality issues (3):**

- `tests/generator.test.js:28-36` — `catalog covers every role` is tautological
  (`assert.ok(CATALOG[r].primary)` asserts the object was constructed). Replace with a
  specific expected value.
- `tests/generator.test.js:135-157` — duplicate of `tests/stack-detect.test.js`. Remove from
  `generator.test.js`.
- `tests/doctor.test.js:49-55` — partial: only asserts the CLI check status when `opencode`
  is missing. Assert the full `checks` array.

---

## TODO-gap reconciliation (from prior validation, 2026-08-01)

| Gap | Status | Evidence |
|---|---|---|
| `buildTeam` drops per-role model overrides | **STILL OPEN** | `src/generator.js:111`; round-trip test doesn't cover. Variant dies with it. |
| `uninstall` requires existing manifest | **STILL OPEN** | `src/cli.js:271-275`; `tests/cli.test.js:110` locks in exit 1. |
| `main()` returns undefined | **PARTIALLY FIXED** | init/models/doctor/uninstall now return; `default:` branch (unknown command) still returns undefined (`src/cli.js:113-117`). |
| Catalog drift `opencode/deepseek-v4-pro` | **FIXED** | `src/model-catalog.js` CATALOG + balanced preset use `opencode-go/deepseek-v4-pro`. |
| Manifest parser is regex | **FIXED** | `src/manifest.js` uses `yaml` package with schema validation. |
| No `uninstall` command | **FIXED** | `armada uninstall [--all] [--dry-run]`. |
| Headless orchestration stalls on `ask` | **FIXED** | `armada init --headless`. |

---

## Recommended fix order

1. **#1 (path traversal)** — security boundary, smallest surface to validate, no behavior
   change for honest input.
2. **#2 (buildTeam model override)** — touches `buildTeam` + add round-trip test that
   actually feeds a hand-set model. Closes the TODO and unblocks #21 + #25.
3. **#3 (empty model "")** + **#4 (uninstall requirementsFile orphan)** + **#5 (uninstall
   no-manifest)** — small, related, all touch the same files. Each gets one test.
4. **#6 (main return on default)** + **#10 (error wrapping)** — tighten CLI contract for
   programmatic callers; one test each.
5. **#7 (schema enforcement)** — enables catching #11, #12, #15, #16 at parse time, so do
   it before tackling those.
6. **#8 (uninstall devcontainer)** + **#9 (opencode.json unscoped allow)** + **#14 (headless
   persists)** — all permission / blast-radius fixes. One test each.
7. Polish: #11, #12, #13, then the LOW items as a single pass.
8. Test gaps: 1-3 + 7-10 are highest signal (CLI contract + manifest contract). Tackle the
   3 quality issues alongside.

After each fix: re-run `node --test 'tests/*.test.js'`; suite must stay green and grow.
