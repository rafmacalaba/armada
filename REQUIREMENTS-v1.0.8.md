# armada v1.0.8 — Orchestrator State-Flow Patch

> Contract. Approved by user. In-window (no dock/voyage). Surgical 6-line patch over v1.0.7 to restore orchestrator state-flow authority. 7 v1.0.3 holes remain open by design.

## Goal

v1.0.7 reverted `src/generator.js` to v1.0.3 baseline. The orchestrator's `edit`
block inherited `armada/*: deny` with no path-specific overrides for the
orchestrator's own state files. This broke the v1.0.6 prompt's hard rules 3-4
(write state on every transition, never end turn with unsaved state) and
disabled 6 specific paths the orchestrator needs.

Patch: add 6 path-specific allows to `BASE_PERMISSIONS.orchestrator.edit` AFTER
`armada/*: deny` (so they win under last-match-wins).

## Risk override (recorded)

User accepted. v1.0.3 surface (7 holes) remains open:

1. `docs` role `edit: { "*": "allow" }`
2. Bash prefix globs (`git status*`, `cat*`, `echo*`)
3. yolo `*` defeats `external_directory: deny` (key order)
4. dev roles missing `"*": "deny"`
5. orchestrator `edit: { "*.md": "allow" }`
6. `WRITE_BASH_DENIES` absent
7. `SAFE_BASH` tier removed

## Phases

### Phase 1 — Generator patch

- **Depends on:** none
- **Goal:** `src/generator.js` `BASE_PERMISSIONS.orchestrator.edit` has 6 new path-specific allows.
- **Success criteria:**
  - [ ] 6 lines added after `armada/*: deny`:
    - `armada/REQUIREMENTS.md: "allow"`
    - `armada/state/active.json: "allow"`
    - `armada/state/features/*: "allow"`
    - `armada/state/contract-approval.json: "allow"`
    - `armada.yaml: "allow"`
    - `TODO.md: "allow"`
  - [ ] No other code or block modified.
  - [ ] `git diff v1.0.7 HEAD -- src/generator.js` shows the 6-line addition only.

### Phase 2 — Version bump

- **Depends on:** Phase 1
- **Goal:** Package version reads `1.0.8`.
- **Success criteria:**
  - [ ] `package.json` `"version": "1.0.8"`.
  - [ ] `src/cli.js:63` `export const VERSION = "1.0.8"`.

### Phase 3 — Changelog

- **Depends on:** Phase 2
- **Goal:** `CHANGELOG.md` documents the patch and confirms the 7 v1.0.3 holes stay.
- **Success criteria:**
  - [ ] `## [1.0.8]` entry present.
  - [ ] Names the 6 restored allows.
  - [ ] References v1.0.7 entry for the 7 holes.
  - [ ] Existing `## [1.0.7]` and prior entries untouched.

## Final criteria

- [ ] `node --test tests/*.test.js` exits 0 (555/555 still pass).
- [ ] `resolvePermission(edit, "armada/state/active.json")` → `"allow"`.
- [ ] `resolvePermission(edit, "armada/ledgers/x/SECURITY_FINDINGS.md")` → `"deny"` (still excluded).
- [ ] `resolvePermission(edit, "src/server.js")` → `"deny"` (still excluded).
- [ ] PR `feat/v1.0.8-orchestrator-state-flow → master` open.
