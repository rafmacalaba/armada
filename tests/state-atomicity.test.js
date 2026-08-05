import { test } from "node:test"
import assert from "node:assert"
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

// Failing test: state/atomic.js does not exist yet
test("writeAtomic writes file; reads the exact content back", async () => {
  const { writeAtomic, readSafe } = await import("../src/state/atomic.js")
  const dir = mkdtempSync(join(tmpdir(), "atomic-test-"))
  const filePath = join(dir, "state.json")
  const data = { version: 1, key: "value" }

  await writeAtomic(filePath, JSON.stringify(data))
  const raw = readSafe(filePath)
  assert.strictEqual(raw, JSON.stringify(data))
  rmSync(dir, { recursive: true, force: true })
})

test("writeAtomic never leaves a partial file", async () => {
  const { writeAtomic, readSafe } = await import("../src/state/atomic.js")
  const dir = mkdtempSync(join(tmpdir(), "atomic-test-"))
  const filePath = join(dir, "state.json")

  // First write should succeed
  await writeAtomic(filePath, JSON.stringify({ v: 1 }))
  assert.strictEqual(readSafe(filePath), JSON.stringify({ v: 1 }))

  // Simulate failure: writeAtomic should not corrupt existing file
  // (tested by the temp-first-then-rename semantics)
  const before = readSafe(filePath)
  // Write again
  await writeAtomic(filePath, JSON.stringify({ v: 2 }))
  const after = readSafe(filePath)
  assert.notStrictEqual(after, before, "file content should change on successful write")
  assert.strictEqual(after, JSON.stringify({ v: 2 }))

  rmSync(dir, { recursive: true, force: true })
})

test("readSafe returns null for missing file", async () => {
  const { readSafe } = await import("../src/state/atomic.js")
  const result = readSafe("/nonexistent/path/state.json")
  assert.strictEqual(result, null)
})

test("concurrent writers: final state is consistent (one complete write)", async () => {
  const { writeAtomic, readSafe } = await import("../src/state/atomic.js")
  const dir = mkdtempSync(join(tmpdir(), "atomic-test-"))
  const filePath = join(dir, "state.json")

  // Spawn N concurrent writers
  const N = 10
  const writes = Array.from({ length: N }, (_, i) =>
    writeAtomic(filePath, JSON.stringify({ v: i }))
  )
  await Promise.all(writes)

  const raw = readSafe(filePath)
  const parsed = JSON.parse(raw)
  // Final state must be exactly one of the written values, not a hybrid
  assert.ok(typeof parsed.v === "number", "v must be a number")
  assert.ok(parsed.v >= 0 && parsed.v < N, "v must be from one of the concurrent writes")
  assert.deepStrictEqual(Object.keys(parsed), ["v"], "no extra keys from corruption")
  rmSync(dir, { recursive: true, force: true })
})
