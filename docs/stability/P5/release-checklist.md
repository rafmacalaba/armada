# P5 — Release checklist

Every artifact a public release of opencode-armada needs. Ticked = verified present in this
lane (2026-08-05); flagged = missing or needs an owner. Version under check: 0.9.2.

## Code and package

- [x] Version synchronized: `package.json:3` = `src/cli.js:44` = 0.9.2 (two-version rule,
  `docs/RELEASING.md:21-23`).
- [x] `engines.node >= 20` (`package.json:29`).
- [x] Single runtime dependency `yaml` (`package.json:42`).
- [x] `files` array ships the runtime surface: src, template, starter, agents, presets,
  docs (`package.json:12-19`). NOTE: docs now includes the six new guides; tarball contents
  should be re-audited at pack time (npm pack smoke counted 91 files, 115.6 kB —
  `docs/stability/P0/npm-pack-smoke.md`).
- [x] Bin declared: `"bin": { "armada": "./src/cli.js" }` (`package.json:6-8`); packed bin
  verified (`docs/stability/P0/npm-pack-smoke.md`).
- [x] `prepublishOnly` runs the full suite (`package.json:26`).
- [ ] **REPO METADATA MISSING:** package.json has no `repository`, `bugs`, or `homepage`
  fields. Add:
  - `"repository": { "type": "git", "url": "git+https://github.com/rafmacalaba/opencode-armada.git" }`
  - `"bugs": { "url": "https://github.com/rafmacalaba/opencode-armada/issues" }`
  - `"homepage": "https://github.com/rafmacalaba/opencode-armada#readme"`
  Owner: P2 (package.json is out of docs scope).

## Docs

- [x] README 60-second path (new-project + existing-repo) — rewritten this phase.
- [x] README prerequisites (Node >= 20, opencode) — added.
- [x] README command table matches the 12 live commands + reconcile alias.
- [x] User guide (`docs/user-guide.md`) — quickstart + every command with an example.
- [x] Operator guide (`docs/operator-guide.md`) — install/upgrade/uninstall/rollback + full
  flag table + exit codes.
- [x] Contributor guide (`docs/contributor-guide.md`) — dev setup, test loop, release flow.
- [x] Support doc (`docs/support.md`) — public channel, response expectations.
- [x] Auth/cost/recovery doc (`docs/auth-and-cost.md`) — providers, budgets, cost, rate
  limits, recovery.
- [x] Troubleshooting doc (`docs/troubleshooting.md`) — error table with canonical fixes.
- [x] Stale docs marked: `docs/using-armada.md` SUPERSEDED banner.
- [x] SPEC/ARCHITECTURE drift fixed (D-01..D-06, G-03; see exec-summary.md).
- [x] LICENSE present (MIT, `LICENSE`), referenced from README.
- [ ] **DOCS IN PACKAGE:** confirm `npm pack` includes the six new docs files (they live
  under `docs/`, which is in `files`). Pack-time verify.

## Distribution and CI

- [x] CI workflow: `npm test` on push/PR (`.github/workflows/ci.yml`).
- [x] Release workflow: tag push -> test -> npm publish (skipped without `NPM_TOKEN`) ->
  GitHub release with auto notes (`.github/workflows/release.yml`).
- [x] npm auth path documented (Automation token or manual, `docs/RELEASING.md`).
- [x] Pack smoke: tarball installs to isolated prefix, bin runs
  (`docs/stability/P0/npm-pack-smoke.md`).
- [ ] **NPX GATE (pack-time):** run `npx opencode-armada --version` from a clean dir to
  confirm the single-bin npx resolution (P0 open question 2;
  `docs/stability/P0/public-presentation.md` P-02).
- [ ] **NPM VIEW GATE (post-publish):** `npm view opencode-armada version` = released tag;
  `npm view opencode-armada repository` shows the new metadata.

## GitHub surface

- [x] Repository URL exists: `git@github.com:rafmacalaba/opencode-armada.git`
  (`.git/config:9`); README + support.md link issues.
- [ ] **ISSUE TEMPLATES MISSING:** `.github/` contains only `workflows/`. Add bug report +
  feature request templates (or at minimum a CONTRIBUTING.md pointing at
  `docs/contributor-guide.md`). Owner: repo maintainer (docs out of scope for .github? —
  templates are doc files; P5 did not add them to avoid scope creep).
- [ ] **Screenshots for README:** no product screenshots exist (armada/screenshots is
  per-feature fleet evidence, not marketing). A README screenshot of an init summary or
  `armada fleet` dashboard would materially help first-time users. Owner: P4/qa or
  maintainer.

## Behavior agreement (docs vs code vs artifacts)

- [x] Help text: all 12 commands + reconcile alias + deprecated + removed sections
  (`src/cli.js:44-90`).
- [x] Generated artifacts: 8 ship-named agents, 4 commands, 9 skills, fleet plugin default-on
  (source-verified; LIVE REPO SAMPLE STALE — see below).
- [x] Exit codes documented (operator-guide) and match P1 behavior.
- [x] Model catalog table in auth-and-cost.md matches `src/model-catalog.js:34-100`.
- [ ] **LIVE REPO RE-SCAFFOLD:** the live repo `.opencode/` is stale — 2 retired command
  files present, generated commodore.md references `/armada-status` (P0 F-01/F-02). Re-run
  `armada init --from-armada armada/armada.yaml` on the live tree before release so the
  generated sample agrees with docs. Owner: P2/P4 or maintainer.
- [ ] **AGENTS.md (repo rules) refresh:** stale command list + opt-in framing for
  fleet-tracker (P0 C-02, E-07). Regenerate the armada block or edit by hand. Owner:
  maintainer (AGENTS.md blocked for P5).
- [ ] **HELP text flags:** HELP omits implemented flags (`--no-browser`, `--dry-run`,
  `--cache`, `--remove`, voyage flag set) — P0 P-07/P-10. Docs are correct; help text needs
  the same flags. Owner: P2 (src/cli.js).

## Verification evidence

- [x] Deterministic suite green at P1 close: 512 pass, 0 fail (`docs/stability/P1/exec-summary.md`).
- [ ] Fresh full-suite run on the packed artifact (P4 acceptance owns this).
- [ ] macOS + Linux evidence plan filed (`docs/stability/P0/macos-linux-evidence-plan.md`);
  execution owned by P4.

## Release steps (from docs/RELEASING.md)

1. Merge the above metadata + help-text fixes.
2. Bump `package.json` + `src/cli.js` to the next version; PR -> merge.
3. `git tag v<X.Y.Z> && git push origin v<X.Y.Z>` (Path A) or manual publish (Path B).
4. Post-publish gates: `npm view`, npx smoke, GitHub release notes.

## Summary

- Done: 24 checks ticked (code, docs, CI, distribution).
- Flagged: 9 items — package.json metadata (P2), npx gate (pack-time), issue templates +
  screenshots (maintainer), live re-scaffold (P2/P4), AGENTS.md refresh (maintainer), help
  text flags (P2), packed-docs audit + final suite (P4).
