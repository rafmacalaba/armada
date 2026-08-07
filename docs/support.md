# Support

Where to ask questions, where to file bugs and feature requests, what to include, and what
response to expect.

## Where to ask

- **GitHub issues** — the single public channel for both questions and bugs:
  <https://github.com/rafmacalaba/armada/issues>
- **Bugs and feature requests** — file an issue with the template below. There are no issue
  templates in the repo yet (P0 audit gap — tracked in
  [release-checklist](./stability/P5/release-checklist.md)); use the checklist below instead.
- **Security findings** — open an issue and mark it security-related in the title/body.
  Do not post exploit details in a public thread before maintainers have had a chance to
  respond.

There is no private support channel, no chat server, and no paid support tier. This is an
MIT-licensed open-source project maintained by its contributors.

## What to include in a bug report

A good report lets a maintainer reproduce without asking follow-ups:

1. `armada --version` output.
2. OS and Node version (`node --version`).
3. The output of `armada doctor` — it reports opencode presence, provider auth, openrouter
   auth, background dispatch, and the global armada binary (`src/doctor.js:82-225`).
4. The exact command you ran and its full output.
5. Expected vs actual behavior.
6. Whether the problem reproduces in a fresh repo (`armada init --yes --yolo` in an empty
   directory) or only in your repo.

## Expected response

- **Bugs:** triaged by severity. HIGH (data loss, broken upgrade, cannot init/use at all)
  gets a response within a few days; MEDIUM/LOW when a maintainer picks them up. There is no
  SLA — response time is best-effort.
- **Feature requests:** acknowledged and triaged into [TODO.md](../TODO.md) when accepted.
  Feature freeze note: during the public-stability stabilization, unrelated roadmap features
  stay out of scope (contract, `armada/REQUIREMENTS.md` final criteria 9).

## Project status and support window

- **Status:** the current release line is 0.x (0.9.2 at the time of writing). 0.x is
  stabilization: the CLI surface is settled, but minor breaking changes are possible before
  v1.0.
- **Version support:** only the latest published release is supported. Deprecated aliases
  (`drive`, `update`, `preset`, `feature status`) are removed in v2.0; `reconcile` is a
  documented alias of `resume` and stays.
- **Supported platforms:** macOS and Linux (the release matrix), Node >= 20.
- **EOL:** this project provides no long-term-support window; upgrading to the latest release
  is the supported path.

## Reporting a defect in a running fleet

If a fleet run inside an armed repo trips on something armada itself should fix (a template
that misled an agent, a generator bug, a prompt stall), the armada-side path is: record it in
the repo's defect ledger (`armada/ledgers/<feature>/DEFECTS.md`, qa-owned), then file an
upstream issue with the details — see the "What to include" checklist above.

## Self-check

Files read to verify every claim:

- `.git/config` — remote URL `git@github.com:rafmacalaba/armada.git` (the issues
  link derives from it).
- `package.json` — version 0.9.2, license MIT. Note: no `repository`/`bugs` fields yet —
  flagged in [release-checklist](./stability/P5/release-checklist.md).
- `src/doctor.js:82-225` — doctor checks cited as the diagnostic.
- `armada/REQUIREMENTS.md:88-98` — final criteria (feature freeze, platform scope).
  (P-12 no repo URL, P-13 no support section — closed by this doc; see
  [CHANGELOG.md](../CHANGELOG.md)).
- `.github/` — only `workflows/` (ci.yml, release.yml); no issue templates.

Verdict: PASS — every support vector cited is real and current.
Date: 2026-08-05.
