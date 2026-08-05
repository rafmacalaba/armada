# Interruption Recovery Evidence

## Exactly-once resume after mid-voyage kill

### Test: `tests/interrupt-exactly-once.test.js`

Six scenarios confirm that interrupted voyages recover without duplicating completed work.

### Scenario 1: Completed actions skipped on resume (test:45)

1. Create voyage state: `createVoyageState` (`src/state/versioned.js:42`)
2. Record `phase-0` as completed: `recordCompletedAction` (`src/voyage/lifecycle.js:65`)
3. Resume with handlers for phases 0, 1, 2
4. **Result:** Only phase-1 and phase-2 execute. Phase-0 skipped (already completed).
5. Final state: all three phases recorded.

### Scenario 2: No re-execution when all complete (test:81)

1. Record all phases as completed
2. Resume with matching handlers
3. **Result:** Zero handlers execute. State unchanged.

### Scenario 3: Failure mid-voyage marks state as interrupted (test:107)

1. Handler for phase-0 throws an error
2. **Result:** State.status becomes "interrupted" (`src/voyage/lifecycle.js:96`)
3. Phase-0 NOT in completedActions (failed before recording)
4. Subsequent resume would re-execute phase-0

### State persistence

- **State path:** `<worktree>/armada/state/voyage.json` (`src/voyage/lifecycle.js:31`)
- **Atomic writes:** `src/state/atomic.js:32` — temp file + rename, no partial reads
- **Idempotent recording:** `src/state/versioned.js:63` — `recordAction` returns unchanged if already recorded

### State before interruption

```json
{
  "version": 1,
  "voyage": "test",
  "status": "interrupted",
  "completedActions": [],
  "createdAt": "2026-08-05T...",
  "updatedAt": "2026-08-05T..."
}
```

### State after recovery

```json
{
  "version": 1,
  "voyage": "test",
  "status": "completed",
  "completedActions": ["phase-0", "phase-1", "phase-2"],
  "createdAt": "2026-08-05T...",
  "updatedAt": "2026-08-05T..."
}
```

Generated at: 2026-08-05
