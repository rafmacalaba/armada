# Parallel A/B Acceptance Evidence

## Two voyages in disjoint docks do not conflict

### Test: `tests/parallel-ab.test.js`

Two scenarios confirm that parallel voyages in separate worktrees operate independently.

### Scenario 1: File isolation in parallel worktrees (test:7)

1. Git init with base commit
2. Create two worktrees: `sandbox/voyage-a` and `sandbox/voyage-b`
3. Write `voyage-a-file.txt` in voyage A only
4. Write `voyage-b-file.txt` in voyage B only
5. **Results:**
   - Voyage A contains `voyage-a-file.txt` but NOT `voyage-b-file.txt`
   - Voyage B contains `voyage-b-file.txt` but NOT `voyage-a-file.txt`
   - Main checkout contains neither file — only `base.txt`

### Scenario 2: Independent state files (test:70)

1. Create two worktrees: `sandbox/alpha` and `sandbox/beta`
2. Write independent voyage states via `writeState` (`src/voyage/lifecycle.js:41`)
3. Both writes run in parallel via `Promise.all`
4. **Results:**
   - `readState(wtA).voyage === "alpha"`
   - `readState(wtB).voyage === "beta"`
   - No cross-contamination

### Worktree listing

Both worktrees visible in `git worktree list`:
```
/path/to/repo                        [main]
/path/to/repo/sandbox/alpha           feat/alpha
/path/to/repo/sandbox/beta            feat/beta
```

### State file isolation

Each worktree has its own `armada/state/voyage.json`:
- `/path/to/repo/sandbox/alpha/armada/state/voyage.json` — voyage "alpha"
- `/path/to/repo/sandbox/beta/armada/state/voyage.json` — voyage "beta"

Cross-reads blocked: `readState(wtA)` only reads from `wtA/armada/state/voyage.json`.

Generated at: 2026-08-05
