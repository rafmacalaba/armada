---
name: armada-voyage-finish
description: Voyage-finalization ritual. Load at voyage end, dispatch a galleon subagent to rebase, fix TODO PR refs, regen scaffold, push, open/update PR. Triggers on: finish voyage, finalize, rebase, PR.
---

# Armada: Voyage Finish

The finalization ritual one voyage closes. Loaded by the orchestrator at voyage-end, then dispatched to a galleon subagent as its task prompt. One-shot, ordered, PR-first.

## Steps (strict order, stop on failure)

1. **Rebase.** `git fetch origin` then `git rebase origin/master`. Fast-forward only. If not a fast-forward, STOP and report to the orchestrator — never force-rebase, never merge.
2. **TODO PR fix.** For each feature this lane shipped, replace its `(#<pending>)` placeholder in `TODO.md` with `(#<PR>)` using the real PR number from `gh pr view --json number`.
3. **Regen scaffold.** `node src/cli.js init --from-armada armada/armada.yaml --target <lane>` so `AGENTS.md`, `REQUIREMENTS.md`, and agents stay in sync with `src/`. The `AGENTS.md` voyage header must not be re-titled.
4. **Commit + push.** Commit the regen + TODO fix on the lane branch and push to origin. Never commit on master.
5. **Open/update PR.** `gh pr create --base master --title ... --body ...` (or `gh pr edit` if the PR already exists). Record the PR URL.

## Forbids

- Never edit `armada/REQUIREMENTS.md`.
- Never close the voyage or mark any feature done.
- Never `git merge` locally, never push master directly.
- Never run `npm publish`.
- Never edit files owned by other voyages or running phases.

Example: dispatch a galleon with this whole body as its task prompt; it executes step 1-5 and returns either a PR URL or the blocker that stopped it.