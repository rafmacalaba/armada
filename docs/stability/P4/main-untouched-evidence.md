# P4 Main Untouched Evidence

## Test Results

```
✔ P4 main untouched: operations in temp dirs do not change main checkout (736.119583ms)
✔ P4 main untouched: concurrent operations do not dirty main (358.504375ms)
✔ P4 main untouched: --restart does not dirty main (226.121584ms)
```

### What was tested

1. **Sequential operations** - Capture git status baseline, run init/doctor/uninstall in temp dir, verify git status unchanged
2. **Concurrent operations** - Init two docks concurrently, uninstall both, verify git status unchanged
3. **--restart** - Init then re-init with --restart, verify git status unchanged

### Git status method

```javascript
function gitStatus(dir) {
  const r = spawnSync("git", ["status", "--short"], { cwd: dir, encoding: "utf8" })
  return r.stdout.trim()
}
```

### Main repo path

The main repo at `/Users/rafaelmacalaba/WBG/opencode-armada` is the reference. All e2e operations run in temp dirs (`/tmp/armada-e2e-*`) which are disjoint from the main repo.

### Key assertion

```javascript
assert.strictEqual(after, baseline, "main checkout git status must not change after e2e operations")
```

Before and after every operation sequence, git status of the main checkout is captured and compared byte-for-byte.
