# armada/ledgers/armada-new-templates/ADVERSARIAL_REVIEW.md — adversary findings

## ADV-001: `--template` flag with no value silently uses blank template

- Session: phase-3 gate
- Suggested severity: MEDIUM

What I did: Ran `armada new my-app --template` (no value after flag).

Expected: Error message about missing template value, or at minimum a warning that `--template` had no argument.

Actual: Command succeeds (exit 0), uses blank template silently. No error, no warning. The `--template` flag is parsed at `src/cli.js:232-233` — when no next arg exists, `template = undefined`. In `runNew` at `src/new-command.js:261`, `if (opts.template)` is falsy (undefined), so it falls through to the internal template path. Non-TTY -> blank. User intent is completely lost.

```
$ node src/cli.js new my-app --template
Created my-app/
  + .opencode/agent/commodore.md
  ...
Next:
  cd my-app
  opencode
  armada status
```

Same issue affects `--config` via identical parsing pattern at `src/cli.js:234-235`.

Disposition: ACCEPTED -> DEF-002  # armada new --template without value silently uses blank; should error

## ADV-002: `_catalog.json` with valid JSON but missing `categories` key throws unhandled TypeError

- Session: phase-3 gate
- Suggested severity: MEDIUM

What I did: Tested catalog JSON where the key is misspelled (`not_categories` instead of `categories`). This is valid JSON — `JSON.parse` succeeds — but the code accesses `.categories.find(...)`. Contract Phase 3 success criterion: "Malformed `_catalog.json` produces a clear error with location."

Expected: Clear error like `_catalog.json is missing required 'categories' array at <path>`.

Actual: Uncaught TypeError with no file path:

```
TypeError: Cannot read properties of undefined (reading 'find')
```

Code path: `src/new-command.js:306` — `catalog.categories.find(...)` runs after parse, no null-safety check on `catalog.categories`. Both read sites (lines 306 and 324) have the same gap.

Malformed JSON (parse failure) at `src/new-command.js:300-304` does produce `"cannot load starter catalog"` — but that message also omits the file location.

Disposition: ACCEPTED -> DEF-003  # _catalog.json missing 'categories' key throws unhandled TypeError; contract SC says clear error

## ADV-003: `defaultVars` from `_catalog.json` never consumed by any code path

- Session: phase-3 gate
- Suggested severity: MEDIUM

What I did: Grepped the entire `src/` tree for `defaultVars`. Zero references. Traced every code path in `runNew` that resolves template variables (`resolveVariables`, `src/new-command.js:134-191`). The function accepts only `discovered` + `opts` — it never receives `defaultVars`. Contract Phase 1 SC declares: `_catalog.json lists 6 entries with id, name, description, defaultVars, dir`. Phase 2 SC: `auto-picks blank + uses defaultVars from catalog`.

Expected: `defaultVars` from the selected catalog entry used as fallback values when no `--config`, env var, or prompt provides a value. E.g., `node_version: "20"`, `python_version: "3.11"` should appear in rendered output when user accepts all defaults.

Actual: All variables without explicit sources get empty strings (`""`):

```
# api-service with --yes (no config, no env)
$ cat package.json | grep '"name"'
  "name": "",
# empty — defaultVars never applied
```

Even in non-TTY mode (blank template), it's a no-op since blank has no placeholders. The data exists in the catalog but has zero runtime effect. No test exercises `defaultVars` application (confirmed: `grep -r defaultVars tests/` returns nothing).

Disposition: ACCEPTED -> DEF-004  # defaultVars from catalog never consumed; contract SC says 'uses defaultVars from catalog'

## ADV-004: Out-of-range numeric input in category picker silently defaults to first entry

- Session: phase-3 gate
- Suggested severity: LOW

What I did: In TTY mode, select a template and type `999` or `-1` at the `Pick 1-6` prompt. Then traced the matching logic in `pickCategory` (`src/questionnaire.js:149-181`).

Expected: Validation error — `"Invalid choice: 999. Pick 1-6."` — and re-prompt.

Actual: Silently selects first entry (blank) with no warning. Code at `src/questionnaire.js:169-171`:

```js
const idx = parseInt(trimmed, 10)
if (Number.isInteger(idx) && idx >= 1 && idx <= categories.length) {
  return categories[idx - 1].id
}
```

`parseInt("999", 10) === 999`, passes `Number.isInteger` and `idx >= 1` but fails `idx <= categories.length` (6). Falls through to string match (no match), falls through to line 180 fallback: `return categories[0].id`. For `-1`, `parseInt("-1", 10) === -1`, fails `idx >= 1`, same fallback path. User receives no feedback that their input was rejected; may not realize wrong template was selected.

Disposition: ACCEPTED -> DEF-005  # out-of-range numeric in picker silently defaults to first; UX bug

## ADV-005: Catalog JSON loaded and parsed twice in single TTY code path

- Session: phase-3 gate
- Suggested severity: LOW

What I did: Traced the TTY code path in `runNew` (`src/new-command.js:281-336`).

Expected: Catalog JSON read once, category selected from it, template resolved from same parsed data.

Actual: Catalog read + parsed at line 300 (`pickCategory` path) and again at line 318 (template resolution path). Both reads in the same `else` branch (internal template). In non-TTY only the second read runs (line 318 alone). The double-read is wasteful and is a correctness risk: if file modified on-disk between reads, selected category could exist in read 1 but produce `"unknown category"` in read 2.

Disposition: REJECTED - v1 deferral  # double-read of catalog in TTY path; no behavior change, theoretical race only. Defer to v2 refactor.

## ADV-006: Catalog load error message omits file path

- Session: phase-3 gate
- Suggested severity: LOW

What I did: Examined error handling at `src/new-command.js:297-304` and `316-323`.

Expected: Contract Phase 3 SC: "Malformed `_catalog.json` produces a clear error with location." Error message should include the `CATALOG_PATH` variable for user to locate the problem.

Actual: `console.error("cannot load starter catalog")` — no path. User with corrupt or moved install gets unhelpful message. `CATALOG_PATH` (line 17) is in scope at both error sites but not included:

```
// src/new-command.js:302
console.error("cannot load starter catalog")  // no path given
```

Disposition: ACCEPTED -> DEF-006  # catalog load error omits file path; contract SC says 'with location'

## ADV-007: 500-character project name causes unhandled process crash after clean error

- Session: final
- Suggested severity: MEDIUM

What I did: Ran `runNew({name: 'a'.repeat(500), yes: true, cwd: tmp})`. Project name passes `validateProjectName` (valid chars, no separators). The `renderCookiecutterTemplate` calls `mkdirSync(destDir, ...)` with the long target path.

Expected: Clean error message + exit code 1. No crash.

Actual: `mkdirSync` fails with `ENAMETOOLONG`. The catch block at `src/new-command.js:388-394` prints the error correctly (`template render failed: ENAMETOOLONG: name too long...`). But then line 392 calls `rmSync(targetDir, ...)` on the same too-long path. Since the directory was never created, and the path exceeds filesystem limits, `rmSync` also throws -- unhandled, crashing the process:

```
Error: , Unknown error: File name too long '/var/folders/.../aaaa...'
    at rmSync (node:fs:1248:18)
    at runNew (file:///.../new-command.js:392:5)
```

Root cause: cleanup `rmSync` in the catch block does not guard against the same `ENAMETOOLONG` failure that caused the original error. Should wrap `rmSync` in its own try/catch or skip cleanup when the directory was never created.

Disposition: ACCEPTED -> DEF-012  # 500-char project name causes unhandled crash; add length check to name validation

## ADV-008: `pickCategory` promise hangs when stdin closes before user input

- Session: final
- Suggested severity: LOW

What I did: Called `pickCategory(categories, {input: ttyStream, output: out})` where `ttyStream.isTTY = true` but the stream is closed (`.end()`) before the user provides input. Uses `createInterfaceSync` with callback-based `rl.question`.

Expected: Either resolve with `categories[0].id` (fallback) or `null` (abort). Process should not hang.

Actual: Readline emits `close` event on EOF but never calls the `line` callback registered by `rl.question`. The `ask()` function's callback never fires, promise never resolves, process hangs forever. The `MAX_ATTEMPTS` guard at `src/questionnaire.js:169` is never reached -- execution is stuck waiting for the callback.

Code path: `src/questionnaire.js:163-173` -- `rl.question(prompt, (raw) => {...})`. If stdin emits EOF before any line is entered, the callback is lost.

Real-world impact: extremely narrow. Requires stdin to be a TTY (`isTTY: true`) yet close before user input -- only happens in test harnesses or unusual pipe scenarios. Real terminals (Ctrl+D) would close the interface and emit `close`, but `rl.question` with callback syntax does not resolve on close.

Disposition: ACCEPTED -> DEF-013  # pickCategory hangs on stdin close; guard with EOF detection and timeout

## Re-validation of previously ACCEPTED findings (final pass)

All 5 previously ACCEPTED findings confirmed fixed:

- **ADV-001/DEF-002** (`--template` no value): `"--template requires a value"` + exit 1. Also `--config` no value: `"--config requires a value"` + exit 1. Fixed at `src/cli.js:232-249`.
- **ADV-002/DEF-003** (missing `categories`): `"starter catalog missing 'categories' array at <path>"` + exit 1. Fixed at `src/new-command.js:329-332`.
- **ADV-003/DEF-004** (`defaultVars` consumed): `resolveVariables(discovered, {yes: true}, defaultVars)` applies all defaultVars values. `--yes`/non-TTY path uses `defaultVars[name]` fallback at `src/new-command.js:189`. Blank template has no placeholders, so defaultVars no-op for blank is correct.
- **ADV-004/DEF-005** (out-of-range numeric): Out-of-range (`999`, `-1`) now shows `"Invalid choice: N. Pick 1-M."` and re-prompts up to 3 attempts. Fixed at `src/questionnaire.js:183-194`.
- **ADV-006/DEF-006** (catalog error path): All four catalog error sites now include `catalogPath`: lines 325, 330-331, 348, 353.

- **ADV-005**: Remains REJECTED (v1 deferral -- double-read of catalog in TTY path). No change.

## Additional verification items (final pass)

- `dot.gitignore` to `.gitignore` rename works for all 5 templates. Rendered projects always have `.gitignore`, never `dot.gitignore`.
- Symlink skip (`src/new-command.js:97-99`) benign: zero symlinks in current template set.
- `JSON_VALIDATE_FILES` check catches broken JSON from malicious `--config` values: `"rendered package.json is not valid JSON -- variable values may have broken structure at <path>"` + cleanup + exit 1.
- `validateProjectName` (`src/cli.js:114-133`) catches null bytes (`\0`, `\x00`) -- DEF-001 fix in place. Ledger still shows OPEN (qa needs to close).
- Non-TTY (pipe): auto-picks blank, exit 0. `--blank`: picks blank, exit 0.
- `armada new` with no name: `"project name is required"` + exit 1.
- Existing directory: `"Directory already exists: <path>"` + exit 1.
- Non-existent `--template` path: `"template not found: <path>"` + exit 1.
- Non-existent `--config` file: `"config file not found: <path>"` + exit 1.
- All 6 templates render via TTY interaction (exit 0).
- Help text (`armada help`) documents `armada new` with `[--blank] [--template <url|path>] [--config <file.json>] [--yes]`.
- 483/483 tests pass.
