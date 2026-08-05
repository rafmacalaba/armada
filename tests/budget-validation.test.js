import { test } from "node:test"
import assert from "node:assert"
import { runCli } from "./helpers.js"

// DEF-002: invalid budget should fail with clear error, not silently fall back to balanced.

test("init --budget ultra exits non-zero with error", async () => {
  const r = await runCli(["init", "--budget", "ultra", "--yes"])
  assert.strictEqual(r.code, 1, "should exit non-zero for unknown budget")
  assert.match(r.stderr, /unknown budget|invalid budget|budget.*not found/i, "should mention budget error")
})

test("init --budget nonexistent exits non-zero with error", async () => {
  const r = await runCli(["init", "--budget", "nonexistent", "--yes"])
  assert.strictEqual(r.code, 1, "should exit non-zero for unknown budget")
  assert.match(r.stderr, /unknown budget|invalid budget|budget.*not found/i, "should mention budget error")
})

test("models nonexistent exits non-zero with error", async () => {
  const r = await runCli(["models", "nonexistent"])
  assert.strictEqual(r.code, 1, "should exit non-zero for unknown budget")
  assert.match(r.stderr, /unknown budget|invalid budget|budget.*not found/i, "should mention budget error")
})

test("models ultra exits non-zero with error", async () => {
  const r = await runCli(["models", "ultra"])
  assert.strictEqual(r.code, 1, "should exit non-zero for unknown budget")
  assert.match(r.stderr, /unknown budget|invalid budget|budget.*not found/i, "should mention budget error")
})
