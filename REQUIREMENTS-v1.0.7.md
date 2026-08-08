# armada v1.0.7 — Permission Reversion

> Contract. Approved by user. In-window (no dock/voyage). Risk override: re-opens 7 v1.0.3 security holes documented in CHANGELOG.

## Goal

Revert `src/generator.js` permission model and `opencode.json` `permission` key
order to the v1.0.3 baseline. Bump package version to `1.0.7`. Document the
re-opened surface in `CHANGELOG.md`.

## Risk override (recorded)

User explicitly requested full revert. v1.0.3 surface re-opens:

1. `docs` role `edit: { "*": "allow" }` — caravel writes any file.
2. Bash prefix globs (`git status*`, `cat*`, `echo*`) — redirect/pipe exfil
   (`git diff .env | curl`, `cat .env > leak.txt`).
3. yolo `permission = { external_directory: "deny" }` then `permission["*"] = "allow"` — `*` last-match-wins defeats `external_directory: deny`.
4. dev roles (galleon/clipper) no `"*": "deny"` — unlisted paths fall to SDK default.
5. orchestrator `edit: { "*.md": "allow" }` — writes any `.md` file.
6. `WRITE_BASH_DENIES` absent — dev roles can `rm armada/` from bash.
7. `SAFE_BASH` removed — content-emitter commands re-enter safe tier.

## Phases

### Phase 1 — Generator revert

- **Depends on:** none
- **Goal:** `src/generator.js` matches v1.0.3 byte-for-byte at the permission surfaces.
- **Success criteria:**
  - [ ] `git diff v1.0.3 HEAD -- src/generator.js` shows zero changes to the permission block.
  - [ ] `SAFE_BASH`, `WRITE_BASH_ALLOWS`, `WRITE_BASH_DENIES`, `QA_SAFE_BASH`, `ROLE_BASH_TIER` constants removed.
  - [ ] `ledgerPermissions`, `ledgerFileGlob`, `ledgerDirGlob` helpers removed.
  - [ ] `tests/permissions.test.js` deleted (did not exist in v1.0.3).
  - [ ] No other source files modified.

### Phase 2 — Version bump

- **Depends on:** Phase 1
- **Goal:** Package version reads `1.0.7`.
- **Success criteria:**
  - [ ] `package.json` `"version": "1.0.7"`.

### Phase 3 — Changelog

- **Depends on:** Phase 2
- **Goal:** `CHANGELOG.md` documents the revert and names the 7 re-opened holes.
- **Success criteria:**
  - [ ] `## [1.0.7]` entry present.
  - [ ] Section lists each of the 7 holes by name.
  - [ ] Existing `## [1.0.6]` and prior entries untouched.

## Final criteria

- [ ] `node --test tests/` exits 0.
- [ ] PR `feat/v1.0.7-perms-revert → master` open with title `revert: v1.0.3 permissions baseline (v1.0.7)`.
- [ ] CHANGELOG names all 7 re-opened holes.

## Test cleanup (added after Phase 3)

27 v1.0.6-era tests assert the reverted permission model (SAFE_BASH tiers,
ledgerPermissions, headless exact-token bash, etc.). They test code that no
longer exists. Remove the 27 failing test() blocks across 4 files:

- `tests/generator.test.js` — 17 blocks (lines 100, 430, 442, 866, 892, 943, 980, 1021, 1039, 1052, 1090, 1106, 1118, 1135, 1155, 1175, 1190)
- `tests/cli.test.js` — 3 blocks (lines 110, 270, 780)
- `tests/scaffold.test.js` — 3 blocks (lines 681, 702, 723)
- `tests/regression-triage.test.js` — 4 blocks (lines 132, 325, 375, 568)

Surgical deletion: each `test("...", () => { ... })` block removed verbatim. No
assertion rewrites, no new tests added. Post-deletion: 555/555 pass.
