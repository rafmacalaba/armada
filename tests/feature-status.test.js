import { test } from "node:test"
import assert from "node:assert"
import { runCli, makeTempRepo } from "./helpers.js"

// Phase 5: armada status --feature <name>

test("status --feature my-feat shows only that feature's row", async () => {
  const dir = makeTempRepo({})
  // Create two features
  await runCli(["feature", "new", "alpha", "--target", dir])
  await runCli(["feature", "new", "beta", "--target", dir])

  // status --feature alpha shows only alpha
  const r = await runCli(["status", "--feature", "alpha", "--target", dir])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /alpha/)
  assert.doesNotMatch(r.stdout, /beta/)
  assert.match(r.stdout, /FEATURE/)
})

test("status --feature nonexistent exits 1 with not found", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["status", "--feature", "nonexistent", "--target", dir])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /feature "nonexistent" not found/)
})

test("status --json --feature my-feat shows single-row JSON", async () => {
  const dir = makeTempRepo({})
  await runCli(["feature", "new", "gamma", "--target", dir])

  const r = await runCli(["status", "--json", "--feature", "gamma", "--target", dir])
  assert.strictEqual(r.code, 0)
  const parsed = JSON.parse(r.stdout)
  assert.strictEqual(parsed.feature, "gamma")
})

test("feature status my-feat prints deprecation then runs status --feature, exits 1", async () => {
  const dir = makeTempRepo({})
  await runCli(["feature", "new", "delta", "--target", dir])

  const r = await runCli(["feature", "status", "delta", "--target", dir])
  assert.match(r.stderr, /deprecated/)
  assert.match(r.stderr, /armada status --feature delta/)
  assert.match(r.stdout, /delta/)
  assert.strictEqual(r.code, 1)
})
