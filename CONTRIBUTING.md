# Contributing to armada

Thanks for considering a contribution. armada is MIT-licensed and welcomes improvements.

---

## Quick orientation

| File | What it covers |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | How armada works — start here |
| [SPEC.md](./SPEC.md) | Design decisions and non-goals |
| [TODO.md](./TODO.md) | The roadmap and open backlog |
| [AGENTS.md](./AGENTS.md) | Rules for agents working on this repo |
| [docs/self-improvement.md](./docs/self-improvement.md) | How armada uses itself to build itself |

---

## Development setup

```bash
git clone https://github.com/rafmacalaba/armada.git
cd armada
npm install
node --test 'tests/*.test.js'         # run the test suite (must pass)
node src/cli.js help                  # verify the CLI
```

**Requirements:** Node.js >= 22. The only runtime dependency is `yaml`.

---

## Making changes

### Small fixes (direct edit)

Doc edits, README updates, single-file bug fixes, and defect ledger maintenance can be edited directly on a branch.

### Feature work (armada lane)

Net-new fleet-orchestrated functionality runs through an armada lane per [docs/self-improvement.md](./docs/self-improvement.md):

1. Create the lane: `git worktree add -b feat/<name> sandbox/<name>`
2. Scaffold the team: `node src/cli.js init --yes --yolo --budget balanced` (from the sandbox)
3. Write the contract at `sandbox/<name>/armada/REQUIREMENTS.md`
4. Drive it: `armada voyage sandbox/<name>`
5. Push the branch and open a PR — never merge locally

The live repo stays pristine — the lane safeguard above is what keeps it that way.

---

## Conventions

- **ESM everywhere.** Imports use explicit `.js` extensions.
- **`yaml` is the only runtime dependency.** Keep it that way.
- **Generator is pure (zero I/O).** `src/generator.js` is deterministic; `src/scaffold.js` owns all file writes.
- **Never clobber user files.** `opencode.json`, `AGENTS.md`, `REQUIREMENTS.md` are written only if absent.
- **TDD.** Write the failing test first, then implement.
- **No emojis** in code, comments, print statements, or logging.

---

## Running tests

```bash
node --test 'tests/*.test.js'         # unit + CLI e2e
npm run test:smoke                    # live OpenRouter smoke (opt-in, needs a credential)
```

Tests must stay fast and deterministic — no network calls in the unit suite.

---

## Opening a PR

1. Branch from `master`
2. Ensure `node --test 'tests/*.test.js'` passes
3. If your change touches generated output, verify round-trip stability:
   `armada init --from-armada armada/armada.yaml` should produce identical output
4. Open a PR with a clear description of what changed and why

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
