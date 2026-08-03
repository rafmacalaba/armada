# Sandbox workflow: working on armada inside a copy

The [armada-improves-armada workflow](./armada-improves-armada.md) scaffolds a team into a
`sandbox/<name>/` worktree — for both audits and feature work on armada itself. This doc covers
the venue mechanics: how to create, scaffold, and clean up a sandbox. Main branch stays
pristine; merge when ready.

## Why

- Long-running work shouldn't litter the live repo with `.opencode/`, `opencode.json`,
  `armada.yaml`, or scratch `RESEARCH.md` files.
- Multiple features can run in parallel, each in its own copy.
- Each copy has its own `node_modules`, `armada/` workspace, and git state — no
  cross-contamination.
- Easy to throw away: `rm -rf sandbox/<name>` if the experiment fails.

## Two flavours

### A. `git worktree` (recommended)

Shares the same `.git` database, so the feature branch is visible from the main
repo and merge is a fast-forward. Cheap on disk; the working tree just sees a
different HEAD.

```bash
# from repo root
git worktree add -b feat/<name> sandbox/<name>
cd sandbox/<name>
npm install
node ../src/cli.js init --from-armada armada/armada.yaml
```

`git worktree list` shows all sandboxes. `git worktree remove sandbox/<name>`
cleans up when done. No `.gitignore` change needed for the worktree itself — git
manages the checkout — but the parent `sandbox/` path is gitignored below.

### B. Plain copy (heavier, fully isolated)

For when you want a true disconnected copy (e.g. testing against an older
upstream tag, or running two opencode instances with no shared state).

```bash
# from repo root
cp -R . sandbox/<name>
rm -rf sandbox/<name>/.git   # or init fresh: git init && git remote add origin <url>
cd sandbox/<name>
npm install
```

This copy is its own repo. `/sandbox/` in `.gitignore` covers it.

## Scaffolding `armada init` inside a sandbox

Two ways to bring the team into a sandbox:

1. **Copy the parent's `armada.yaml`** — same team/preset as the live repo:
   ```bash
   mkdir -p armada && cp ../armada/armada.yaml armada/armada.yaml
   node ../src/cli.js init --from-armada armada/armada.yaml
   ```
2. **Run fresh `init`** — let stack detection and the questionnaire pick the team
   for the sandbox context:
   ```bash
   node ../src/cli.js init --stack docs --budget balanced
   ```

`armada init` writes only into the cwd, so the parent repo is never touched.
Worktree checkouts record the scaffold on the feature branch directly; plain
copies record it in the sandbox's own `.git`.

## Lifecycle

```
create → work → test → merge → clean
```

- **create**: `git worktree add -b feat/<name> sandbox/<name>` (or `cp -R` for plain).
- **work**: edit, run tests, scaffold the team, drive `/armada`.
- **test**: `node --test 'tests/*.test.js'` from the sandbox root. Must be green.
- **merge**: from the main repo, `git merge feat/<name>` (or open a PR).
- **clean**: `git worktree remove sandbox/<name>` (worktree) or `rm -rf sandbox/<name>` (plain).

## Sandbox vs. external sibling

The repo is also used *from outside* via a sibling directory (e.g.
`../opencode-armada-sandbox/landing-page/`) — that's where you scaffold a team
to build unrelated things (a landing page, a side project) without modifying
armada. Keep the two patterns separate:

- `sandbox/<name>/` — **inside** the repo, for working on the repo itself.
- `../<sibling>/<project>/` — **outside** the repo, for using armada to build
  other things.

## `.gitignore`

The repo gitignores `/sandbox/` so a stray `git add .` from the parent never
sweeps in a full copy. Worktree checkouts don't need their own entry — git
manages them.

```gitignore
# Plain-copy sandboxes (worktree paths are git-managed)
/sandbox/
```

If a plain-copy sandbox needs to keep its own `.git`, the worktree flavour is
usually a better fit.

## Conventions

- **Branch name:** `feat/<short-kebab>` (e.g. `feat/init-flag`, `feat/sandbox-doc`).
- **Sandbox path mirrors branch:** `sandbox/feat-init-flag/`.
- **One feature per sandbox.** If work splits, branch from the feature, not master.
- **Don't merge broken state.** Tests must be green in the sandbox before merge.
  See [docs/validation.md](./validation.md).

## Engine note: `.slim/worktrees/`

The superpowers `worktrees` skill has its own
convention: `.slim/worktrees/<slug>/`, with a `.slim/worktrees.json` manifest
managed by the `worktrees` skill. It is functionally equivalent to this doc's
`sandbox/` path — git worktree, isolated lane, ignored — just under a different
name and tied to engine skill state.

Use `sandbox/` when you want a self-contained convention owned by this repo.
Use `.slim/worktrees/` when you want the engine to track the lane in its
manifest and benefit from skill-driven orchestration hooks.

Both are valid; pick one per project and stay consistent.

## Worked example: landing page

A landing page for opencode-armada is being built at `sandbox/landing-page/`:

```
sandbox/landing-page/
├── armada/
│   ├── armada.yaml                # balanced preset manifest
│   └── REQUIREMENTS.md            # 6-phase contract
├── .opencode/                     # 8 role prompts + /armada command
├── opencode.json                  # model + permissions
├── AGENTS.md                      # team rulebook
└── README.md                      # seed context
```

Source material the team mines for claims (read-only, parent repo):

- `../../AGENTS.md`
- `../../SPEC.md`
- `../../TODO.md`
- `../../ARCHITECTURE.md`
- `../../presets/*.yaml`

Drive it:

```bash
cd sandbox/landing-page
opencode
# /armada
```

Path note: it lives inside the repo at `sandbox/landing-page/`, not at an
external sibling. Keeping it inside skips `external_directory` permission
friction (the `opencode.json` permission for that is `deny` by default) and
matches the convention in this doc.

## See also

- [docs/armada-improves-armada.md](./armada-improves-armada.md) — the two-lane workflow this venue serves (audit + feature).
- [docs/validation.md](./validation.md) — what "done" means.
- [TODO.md](../../TODO.md) — current roadmap.
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — module map and data flow.
