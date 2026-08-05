# Atomic State Evidence

## Atomic versioned state writes

### Test: `tests/state-atomicity.test.js` + `tests/state-versioning.test.js`

Eleven tests confirm state persistence is atomic, versioned, and corruption-resistant.

### Atomic writes (`src/state/atomic.js:32`)

1. **Exact content round-trip** (test:8): Write -> read -> identical content
2. **No partial files** (test:19): Two sequential writes, each produces complete JSON
3. **Missing file returns null** (test:34): `readSafe("/nonexistent") === null`
4. **Concurrent writers produce consistent state** (test:39): 10 concurrent `writeAtomic` calls, final state is exactly one write — no hybrid/corrupt JSON

**Mechanism:** Temp file + `renameSync` is atomic on POSIX. Readers never see a partial file because `renameSync` replaces the target atomically.

### Versioned state (`src/state/versioned.js`)

1. **STATE_VERSION >= 1** (test:8): Positive integer
2. **Fresh state has version** (test:14): `createVoyageState().version === STATE_VERSION`
3. **Idempotent action recording** (test:31): Recording same action twice returns same state
4. **Version upgrade** (test:46): v0 state (no version field) upgraded to current version
5. **Current version unchanged** (test:54): Already-current state not modified
6. **Validation rejects invalid** (test:62): null, missing voyage, non-numeric version all rejected
7. **Validation accepts valid** (test:68): Valid state passes `validateVoyageState`

### Race test output

10 concurrent `writeAtomic` calls to same file:
```
All writes complete. Final state: { v: 7 }  (one of the 10 values)
Keys: ["v"]  (no extra keys from corruption)
```

No partial JSON, no interleaved writes, no corruption. The POSIX rename guarantees exactly one writer's output survives.

Generated at: 2026-08-05
