# Contributor guide

How to develop armada itself: dev setup, the test loop, the release flow, and the contract workflow (how feature work runs through armada). For using armada on armada's own repo, see [self-improvement.md](./self-improvement.md) and [sandbox.md](./sandbox.md).

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

- Node.js >= 20 (`package.json`); ESM everywhere, imports use explicit `.js` extensions.
- One runtime dependency: `yaml` (`package.json`). The questionnaire stays zero-dep.
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

- `npm run test:smoke` — live OpenRouter smoke against the cheapest model; skipped cleanly without a credential.
- `npm run test:node` — alias of `npm test`.
- `node src/cli.js help` — CLI smoke (exit 0).
- Round-trip: `armada init --from-armada armada.yaml` must reproduce the identical team (guards the manifest parser).
- Dogfood: scaffolding over this repo's own instruction files must not clobber them.

TDD: write the failing test first, then implement.

## Code conventions

- `src/generator.js` is pure (zero I/O); `src/scaffold.js` owns all file writes. Every renderer is a pure function, every write goes through scaffold.
- Never clobber user files: `opencode.json`, `REQUIREMENTS.md` are written only if absent; `AGENTS.md` is marker-merged; `armada.yaml` and `.opencode/` are armada-owned, always rewritten.
- Prompt templates use `{placeholder}` syntax; a test asserts no dangling placeholders.
- Model IDs are `provider/model` (e.g. `opencode-go/minimax-m3`), never bare names.
- Agent prompts ship terse/caveman output contracts to reduce token burn.
- No emojis in code, comments, print statements, or logging.

## Feature work runs through armada

Whether a feature request runs in-window or as an armada lane is decided by scope: small fixes run in-window, while multi-file functionality runs in an armada lane per [self-improvement.md](./self-improvement.md):

1. Create the lane: `git worktree add -b feat/<name> sandbox/<name>`
2. Scaffold the team into it: `node ../../src/cli.js init --yes --yolo --budget balanced` (run from the sandbox)
3. Write the feature contract at `sandbox/<name>/armada/REQUIREMENTS.md`
4. Drive it: `armada voyage sandbox/<name>`
5. Verify evidence (tests green), then push the branch and open a PR — never merge locally.

## Contract workflow (per feature)

Each feature lives in `sandbox/<name>/` (a worktree on `feat/<name>`) with:

- `armada/REQUIREMENTS.md` — the contract: phases with dependency order + success criteria. Co-written one question at a time; never build against a DRAFT contract.
- `armada/ledgers/<feature>/` — DEFECTS.md (qa-owned), ADVERSARIAL_REVIEW.md (adversary), SECURITY_FINDINGS.md (security).
- `armada/e2e/<feature>/` — end-to-end evidence, qa-owned.
- `armada/state/` — per-feature state, restart-proof.

Phases pass only on evidence — a passing test run, a screenshot, or a file:line citation. Independent phases run in parallel as background subagents with disjoint file scope.

## Release flow

Cutting a release is a two-artifact operation keyed off a `vX.Y.Z` git tag; full details in [RELEASING.md](./RELEASING.md). The essentials:

- Version lives in two places, kept in sync: `package.json` and `src/cli.js` (`VERSION`).
- `.github/workflows/ci.yml` runs `npm test` on every push/PR; `release.yml` (tag push) runs test -> publish (npm, skipped without `NPM_TOKEN`) -> GitHub release.
- Branch protection: never push straight to `master`; every bump and doc change lands via a PR.
- `prepublishOnly` runs the full suite before publish.

See [RELEASING.md](./RELEASING.md) for the release procedure.
