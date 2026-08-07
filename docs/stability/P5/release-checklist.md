# Release checklist

Pre-shipping checklist for an armada release. Companion to [RELEASING.md](../../RELEASING.md);
keep the full mechanics there, use this file as the run-a-shift checklist.

## Before cutting `vX.Y.Z`

- [ ] `npm test` green (full suite, `node --test 'tests/*.test.js'`).
- [ ] `npm run test:smoke` passes when a live credential is available (skipped cleanly without).
- [ ] CI (`.github/workflows/ci.yml`) green on the target branch.
- [ ] Changelog updated (`CHANGELOG.md`): added/changed/fixed/security per Keep a Changelog.
- [ ] Version bumped in BOTH places and kept in sync: `package.json` and `src/cli.js` `VERSION`.
- [ ] No `repository`/`bugs` gaps in `package.json` — the issue link derives from the remote URL.
- [ ] `armada doctor` passes against a freshly scafolded temp repo.
- [ ] Packed install smoke: tarball installs to an isolated prefix and the `armada` bin runs.

## Publishing

- Tag `vX.Y.Z` and let `release.yml` publish, or hand-publish `npm publish --access public`
  (Path B in `docs/RELEASING.md`).
- Open a GitHub release; link the tag; summarize changes and test evidence.

## After

- [ ] Verify the published tarball matches origin HEAD (no stale URLs).
- [ ] File or close any release-blocking defects; gate the release on evidence.

## See also

- [RELEASING.md](../../RELEASING.md) — full release mechanics
- [operator-guide.md](../../operator-guide.md) — upgrade / rollback for end users
- [support.md](../../support.md) — issue/release-blocking how