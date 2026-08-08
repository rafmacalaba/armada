# Troubleshooting

Common errors, their cause, and the canonical fix. Every fix cites the source that detects or
reports the condition. When in doubt, run `armada doctor` first — it checks opencode,
providers, openrouter auth, background dispatch, node, and the global armada binary
(`src/doctor.js:82-225`).

## armada: command not found

- **Cause:** the package is not installed, or its bin dir is not on PATH.
- **Fix:** `npm install -g @rafmacalaba/armada`, then open a new shell. Verify with
  `armada --version`.
- **Detection:** `armada doctor` reports "armada not on PATH — run npm link from
  ~/WBG/armada" for the in-tree case (`src/doctor.js:165-171`).

## Broken armada symlink / symlink loop

- **Cause:** a `npm link` pointing at a deleted worktree, or a looped symlink.
- **Fix:** remove the stale link and re-link: `npm unlink -g @rafmacalaba/armada`, then
  `npm link` from the repo root. For an `ELOOP`, remove the loop and re-link.
- **Detection:** `src/doctor.js:155-163` — "symlink loop detected at <path>" or
  "broken symlink".

## doctor: "opencode CLI: fail"

- **Cause:** opencode is not installed or not on PATH.
- **Fix:** install opencode (<https://opencode.ai>); it is the required runtime
  (`src/doctor.js:86-91`).

## doctor: "openrouter auth: fail"

- **Cause:** no OpenRouter credential and `OPENROUTER_API_KEY` unset.
- **Fix:** run `/connect openrouter` inside opencode, or set `OPENROUTER_API_KEY`. Only
  needed for OpenRouter fallback / power-tier models; the default opencode providers work
  without it (`src/doctor.js:100-111`).

## doctor: "background dispatch" not set

- **Cause:** `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS` is not `true`.
- **Fix:** export `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true` before launching opencode
  to enable native parallel background subagents. Without it, dispatch falls back to inline —
  slower but functional (`src/doctor.js:113-120`).

## doctor: "model-drift: warn"

- **Cause:** `armada.yaml` says one model but the rendered agent frontmatter says another
  (e.g. you edited the manifest without re-scaffolding).
- **Fix:** `armada init --from-armada armada/armada.yaml --restart`, then re-run
  `armada doctor` (`src/doctor.js:38-79`).

## doctor: "supervision plugin / fleet tracker plugin / watchdog plugin: fail"

- **Cause:** the manifest enables a plugin but `.opencode/plugins/<name>.js` is missing
  (e.g. a hand-deleted plugin file).
- **Fix:** re-run `armada init --from-armada armada/armada.yaml --restart`
  (`src/doctor.js:184-219`). The fleet tracker is default-on; opt out with
  `--no-fleet-tracker` (`src/scaffold.js:420-423`).

## "Manifest not found: <file>"

- **Cause:** `armada init --from-armada <file>` points at a missing or unreadable file.
- **Fix:** check the path; the default is `armada/armada.yaml`. The command exits 1 with
  "Manifest not found" for a missing file and a parse error for invalid YAML
  (`src/cli.js:300-316`).

## "Unknown command: <cmd>"

- **Cause:** typo, or a removed command. `armada ping` and `armada scout` were removed
  (ping -> `armada help`; scout -> `/armada-scout` in the TUI).
- **Fix:** `armada help` for the full list (`src/cli.js:216-221`).

## Deprecated alias exits 1 (drive / update / preset / feature status)

- **Cause:** not an error — the alias is deprecated and always exits non-zero to force
  migration.
- **Fix:** use the canonical form: `voyage`, `init --from-armada --restart`,
  `init --budget <name>`, `status --feature <name>` (`src/cli.js:147-201`).
- **Note:** `armada reconcile` is a documented alias of `resume`, not deprecated; it exits
  0/1/2 like resume (P1 change, see [CHANGELOG.md](../CHANGELOG.md)).

## armada resume exits 2

- **Cause:** evidence drifts between the contract and repo reality — a phase claims done but
  its success criteria lack proof, or files changed since state was written.
- **Fix:** read the drift list from `armada resume` output, re-run the failed evidence or
  correct the state, then re-run `armada resume` until clean. Resume is read-only; it never
  auto-fails a phase (`src/cli.js:75-77`, `src/resume-cli.js`).

## "lane path not found: <path>" (v1.x)

- **Cause:** `armada voyage <lane>` in v1.x pointed at a directory that did not exist.
- **Fix (v2.0):** use `armada voyage <name>` which creates the worktree automatically. Old
  `<lane-path>` form prints a migration hint.

## "error: session name cannot start with '-'"

- **Cause:** `--name` value begins with a dash (parsed as a flag).
- **Fix:** use `--name <non-dash-name>` or `--name=<value>` (`src/cli.js:644-649`).

## "error: timeout must be a positive integer"

- **Cause:** `--timeout` is non-numeric or <= 0.
- **Fix:** pass a positive millisecond value, e.g. `--timeout 60000` (`src/cli.js:673-683`).

## "error: --prompt value cannot start with '--'"

- **Cause:** `--prompt` followed by a value that begins with `--`.
- **Fix:** use `--prompt=<text>` (`src/cli.js:660-668`).

## armada feature close refuses to ship

- **Cause:** feature close is evidence-gated; a success criterion lacks a passing test,
  screenshot, or citation.
- **Fix:** complete the missing evidence, then `armada feature close <name>` again
  (`src/cli.js:903-923`).

## "Invalid project name" / directory already exists (armada new)

- **Cause:** project name starts with `--`, or the target directory exists.
- **Fix:** pick a plain name and a free directory. `--help` is rejected as a project name
  (`src/cli.js:156-165`; `src/new-command.js:177-181`).

## uninstall leaves .opencode/ behind

- **Cause:** `.opencode/` still contains non-armada files; uninstall only removes
  armada-owned files and refuses to delete the rest.
- **Fix:** check the warning list, remove your own files, then run
  `armada uninstall` again or remove `.opencode/` by hand (`src/scaffold.js:527-539`).

## "armada update"/"armada preset" hint about v2.0

- **Cause:** deprecated aliases removed in v2.0.
- **Fix:** `armada init --from-armada armada/armada.yaml --restart` (update) or
  `armada init --budget <name>` (preset).

## Fleet lane shows STALLED

- **Cause:** no heartbeat for 2+ minutes — the lane died, or was booted without
  `--heartbeat`/the fleet tracker.
- **Fix:** `armada fleet <session>` for detail, then re-attach: `armada voyage sandbox/<name>`
  or `armada voyage attach <name>` (`src/fleet-tracker.js:117`).

## Model catalog looks stale

- **Cause:** the availability cache predates provider changes.
- **Fix:** `armada models --refresh` (cache at `~/.armada/models.cache.json`,
  `src/model-catalog.js:116-118`); `armada models --list-openrouter` for the live list.

## Version mismatch between package and help

- **Cause:** `package.json` version and `src/cli.js` `VERSION` drifted — a release-process
  error.
- **Fix:** bump both to the same value (two-version rule, `docs/RELEASING.md:21-23`). Report
  it as a bug if you hit it in a published release.

## Self-check

Files read to verify every claim:

- `src/cli.js` (949 lines) — every error string cited (manifest not found, unknown command,
  session name, timeout, prompt, feature close, new name).
- `src/doctor.js` (226 lines) — every doctor check cited (opencode, providers, openrouter,
  background dispatch, global binary, model drift, plugins).
- `src/scaffold.js:420-423, 449-556` — fleet-tracker default, uninstall warnings.
- `src/fleet-tracker.js:117` — STALLED threshold (referenced via P0 evidence).
- `src/model-catalog.js:116-118` — cache path.
- `docs/RELEASING.md:21-23` — two-version rule.
- `CHANGELOG.md` — reconcile/alias exit-code behavior.

Verdict: PASS — every error condition maps to a real code path and a working fix.
Date: 2026-08-05.
