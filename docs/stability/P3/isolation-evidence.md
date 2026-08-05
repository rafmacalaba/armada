# Isolation Evidence

## Main checkout untouched after voyage operations

### Test: `tests/voyage-isolation.test.js`

Three test scenarios confirm that the main checkout is never mutated by voyage operations:

1. **git status before/after voyage simulation** (test:8)
   - Captures `git status --porcelain` before and after a simulated voyage
   - Asserts byte-identical output: main working tree is untouched

2. **Voyage operations only affect worktree** (test:27)
   - Creates a git worktree for a voyage
   - Writes files inside the worktree only
   - Verifies main checkout HEAD and tracked file content are identical before and after
   - Evidence: `src/voyage/worktree.js:27` — worktrees created in `sandbox/` only

3. **Main checkout files unchanged after worktree creation and removal** (test:53)
   - Reads file content before worktree creation
   - Creates worktree via `createVoyageWorktree` (`src/voyage/worktree.js:27`)
   - Reads same file after creation — content identical
   - Removes worktree via `removeVoyageWorktree` (`src/voyage/worktree.js:55`)
   - Reads same file after removal — content identical

### Key mechanism

- `src/feature-commands.js:236` — `createFeature` refuses in-tree creation inside worktree
- `src/voyage/worktree.js:27` — `createVoyageWorktree` always writes to `sandbox/<name>/`, never main
- `src/voyage/isolation.js:58` — `checkPreMutation` refuses voyage if main is dirty

### git status diff

Before voyage:
```
(empty — clean)
```

After voyage (with worktree):
```
?? sandbox/   (git worktree administrative entry, not a real file change)
```

Main checkout tracked files: unchanged (verified by content comparison in test 2 and 3).

Generated at: 2026-08-05
