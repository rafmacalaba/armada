import { test } from "node:test"
import assert from "node:assert"
import { runCli } from "./helpers.js"

// DEF-006: armada new project name must reject path traversal and dangerous names.

test("armada new ../escape exits non-zero with error", async () => {
  const r = await runCli(["new", "../escape", "--yes"])
  assert.notStrictEqual(r.code, 0, "traversal name should be rejected")
  assert.match(r.stderr, /invalid|traversal|path|name/i, "should mention invalid name")
})

test("armada new /abs/path exits non-zero with error", async () => {
  const r = await runCli(["new", "/abs/path", "--yes"])
  assert.notStrictEqual(r.code, 0, "absolute path should be rejected")
  assert.match(r.stderr, /invalid|path|name/i, "should mention invalid name")
})

test("armada new name/with/slashes exits non-zero with error", async () => {
  const r = await runCli(["new", "name/with/slashes", "--yes"])
  assert.notStrictEqual(r.code, 0, "name with slashes should be rejected")
  assert.match(r.stderr, /invalid|path|name/i, "should mention invalid name")
})

test("armada new name\\with\\backslash exits non-zero with error", async () => {
  const r = await runCli(["new", "name\\with\\backslash", "--yes"])
  assert.notStrictEqual(r.code, 0, "name with backslash should be rejected")
  assert.match(r.stderr, /invalid|path|name/i, "should mention invalid name")
})

test("armada new with empty name exits non-zero with error", async () => {
  // The CLI already rejects missing names — use --help-like arg to trigger early check
  const r = await runCli(["new", "--yes"])
  assert.notStrictEqual(r.code, 0, "missing name should be rejected")
})

test("armada new with name starting with - exits non-zero", async () => {
  const r = await runCli(["new", "-badname", "--yes"])
  assert.notStrictEqual(r.code, 0, "name starting with - should be rejected")
  assert.match(r.stderr, /invalid|project name|cannot start/i, "should mention invalid name")
})
