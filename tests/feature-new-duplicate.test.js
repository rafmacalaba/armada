import { test } from "node:test"
import assert from "node:assert"
import { readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { runCli, makeTempGitRepo } from "./helpers.js"

// DEF-003: feature new should refuse to overwrite existing feature without --force.

test("feature new with duplicate name exits non-zero with error", async () => {
  const dir = makeTempGitRepo({})
  // Create first feature
  let r = await runCli(["feature", "new", "myfeature"], { cwd: dir })
  assert.strictEqual(r.code, 0, "first feature create should succeed")

  // Verify the contract exists
  const { existsSync: ex } = await import("node:fs")
  assert.ok(ex(join(dir, "armada", "contracts", "myfeature.md")), "contract file should exist")

  // Try to create same feature again
  r = await runCli(["feature", "new", "myfeature"], { cwd: dir })
  assert.strictEqual(r.code, 1, "duplicate feature create should exit non-zero")
  assert.match(r.stderr, /already exists|exists|duplicate|--force/i, "should mention existing feature")
})

test("feature new with duplicate name and --force succeeds", async () => {
  const dir = makeTempGitRepo({})
  let r = await runCli(["feature", "new", "myforce"], { cwd: dir })
  assert.strictEqual(r.code, 0, "first feature create should succeed")

  // Force overwrite
  r = await runCli(["feature", "new", "myforce", "--force"], { cwd: dir })
  assert.strictEqual(r.code, 0, "feature new --force should succeed")
  // Should mention "overwrite" or "force" or "recreated"
  const msg = (r.stdout + r.stderr).toLowerCase()
  assert.ok(msg.includes("created") || msg.includes("overwrite") || msg.includes("force"), "should confirm creation or overwrite")
})
