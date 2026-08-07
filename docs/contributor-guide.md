# Contributor guide

How to develop armada itself: dev setup, the test loop, the release flow, and the
contract workflow (how feature work runs through armada). For using armada on armada's own
repo, see [armada-improves-armada.md](./armada-improves-armada.md) and
[sandbox.md](./sandbox.md).

## Repository layout

```
src/                 CLI + library (27 modules; see ARCHITECTURE.md for the map)
agents/<role>/       per-role prompt templates with {placeholders}
presets/*.yaml       budget presets (free / balanced / power)
template/            static template files (devcontainer)
starter/<category>/  cookiecutter-style repo templates (web-app, ml-training, research-paper)
tests/               node:test suites (+ tests/fixtures/ stack-detection corpus)
docs/                user, operator, contributor, support, auth/cost, troubleshooting, release
```

## Dev setup

- Node.js >= 20 (`package.json:29`); ESM everywhere, imports use explicit `.js` extensions.
- One runtime dependency: `yaml` (`package.json:42`). The questionnaire stays zero-dep.
- No build step. `npm ci`, then `npm start` / `node src/cli.js`.

```bash
git clone git@github.com:rafmacalaba/armada.git
cd armada
npm ci
node src/cli.js help
```

## Test loop

The deterministic suite must stay green before any commit:

```bash
npm test                  # node --test 'tests/*.test.js'
```

Additional loops:

- `npm run test:smoke` — live OpenRouter smoke against the cheapest model; skipped cleanly
  without a credential.
- `npm run test:node` — alias of `npm test`.
- `node src/cli.js help` — CLI smoke (exit 0).
- Round-trip: `armada init --from-armada armada.yaml` must reproduce the identical team
  (guards the manifest parser).
- Dogfood: scaffolding over this repo's own instruction files must not clobber them.
- Suite conventions: fast and deterministic, no network calls in tests; fake `opencode` /
  `tmux` binaries are injected via PATH (`tests/helpers.js` `makeBin`).

TDD: write the failing test first, then implement (`src/skills/armada-tdd/SKILL.md`).

## Code conventions

- `src/generator.js` is pure (zero I/O); `src/scaffold.js` owns all file writes. Keep it
  that way — every new renderer is a pure function, every write goes through scaffold.
- Never clobber user files: `opencode.json`, `REQUIREMENTS.md` are written only if absent;
  `AGENTS.md` is marker-merged; `armada.yaml` and `.opencode/` are armada-owned, always
  rewritten (`src/scaffold.js:360-401`).
- Prompt templates use `{placeholder}` syntax; a test asserts no dangling placeholders.
- Model IDs are `provider/model` (e.g. `opencode-go/minimax-m3`), never bare names.
- Agent prompts ship terse/caveman output contracts to reduce token burn.
- No emojis in code, comments, print statements, or logging.

## Feature work runs through armada

Whether a feature/implementation request runs in-window or as an armada lane — and how a
broad task splits into lanes — is decided by [docs/process/triage.md](./process/triage.md),
the sole triage authority (in-window first, voyage by exception). Link there; do not restate
the policy inline. When a request is classified as a voyage, the lane mechanics are
mandatory:

1. Create the lane: `git worktree add -b feat/<name> sandbox/<name>`
2. Scaffold the team into it: `node ../../src/cli.js init --yes --yolo --budget balanced`
   (run from the sandbox)
3. Write the feature contract at `sandbox/<name>/armada/REQUIREMENTS.md` (leave blank to
   co-write with the orchestrator)
4. Drive it: `tmux new-session -d -s <name> -c sandbox/<name> 'opencode'` — the orchestrator
   boots and dispatches. (Or use `armada voyage sandbox/<name>`.)
5. Verify evidence (tests green), then push the branch and open a PR — never merge locally.

The live repo stays pristine — never scaffolded, never edited by voyage work; the in-window
path for small fixes and defect-ledger maintenance is governed by docs/process/triage.md, and
net-new functionality that the triage doc classifies as a lane must stop-and-propose that lane
first.

## Contract workflow (per feature)

Each feature lives in `sandbox/<name>/` (a worktree on `feat/<name>`) with:

- `armada/REQUIREMENTS.md` — the contract: phases with dependency order + success criteria.
  Co-written one question at a time; never build against a DRAFT contract.
- `armada/ledgers/<feature>/` — DEFECTS.md (qa-owned), ADVERSARIAL_REVIEW.md (adversary),
  SECURITY_FINDINGS.md (security). Statuses and writers are enforced; see the generated
  AGENTS.md armada block in any armed repo.
- `armada/e2e/<feature>/` — end-to-end evidence, qa-owned.
- `armada/state/` — per-feature state, restart-proof.

Phases pass only on evidence — a passing test run, a screenshot, or a file:line citation.
Independent phases run in parallel as background subagents with disjoint file scope.

## Release flow

Cutting a release is a two-artifact operation keyed off a `vX.Y.Z` git tag; full details in
[RELEASING.md](./RELEASING.md). The essentials:

- Version lives in two places, kept in sync: `package.json:3` and `src/cli.js:44`
  (`VERSION`). `RELEASING.md:21-23` documents the two-version rule; drift breaks
  `armada help` output vs npm metadata.
- `.github/workflows/ci.yml` runs `npm test` on every push/PR; `release.yml` (tag push) runs
  test -> publish (npm, skipped without `NPM_TOKEN`) -> GitHub release.
- Branch protection: never push straight to `master`; every bump and doc change lands via a PR.
- `prepublishOnly` runs the full suite before publish (`package.json:26`).

Before shipping a release, run the checklist in
[docs/stability/P5/release-checklist.md](./stability/P5/release-checklist.md).

## Self-check

Files read to verify every claim:

- `package.json` — engines, scripts (`test`, `test:smoke`, `prepublishOnly`), files, bin.
- `src/cli.js:44` — VERSION; `src/cli.js:189-309` — dispatch.
- `src/scaffold.js:360-401` — no-clobber/ownership rules.
- `.github/workflows/ci.yml` + `.github/workflows/release.yml` — CI/release gates.
- `docs/RELEASING.md` — two-version rule, branch protection, publish paths.
- `docs/armada-improves-armada.md` — lane flow (referenced, not rewritten).
- `AGENTS.md` — working-here conventions (test loop, lane rules).
- `CHANGELOG.md` — release and test-suite history (P1 close at 512 pass, 0 fail).

Verdict: PASS — dev setup, test loop, conventions, lane flow, and release flow match current
repo state.
Date: 2026-08-05.
