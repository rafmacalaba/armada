import { test } from "node:test"
import assert from "node:assert"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { tmpdir } from "node:os"
import { mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const CLI = resolve(process.cwd(), "src/cli.js")

// Test that the checkNodeRuntime function rejects Node < 20.
// We test the function directly (it must be exported) and also test
// that the check appears early in cli.js.
import { checkNodeRuntime } from "../src/cli.js"

test("checkNodeRuntime returns null for Node >= 20", () => {
  const result = checkNodeRuntime("20.0.0")
  assert.strictEqual(result, null)
})

test("checkNodeRuntime returns null for Node 22", () => {
  const result = checkNodeRuntime("22.11.0")
  assert.strictEqual(result, null)
})

test("checkNodeRuntime returns null for Node 23", () => {
  const result = checkNodeRuntime("23.9.0")
  assert.strictEqual(result, null)
})

test("checkNodeRuntime returns error string for Node 18", () => {
  const result = checkNodeRuntime("18.20.0")
  assert.ok(result !== null, `expected error string for Node 18, got null`)
  assert.ok(typeof result === "string", `expected string, got ${typeof result}`)
  assert.match(result, /Node\.js >= 20/)
  assert.match(result, /18\.20\.0/)
})

test("checkNodeRuntime returns error string for Node 16", () => {
  const result = checkNodeRuntime("16.0.0")
  assert.ok(typeof result === "string")
  assert.match(result, /Node\.js >= 20/)
})

test("checkNodeRuntime returns error string for Node 0.12", () => {
  const result = checkNodeRuntime("0.12.18")
  assert.ok(typeof result === "string")
  assert.match(result, /Node\.js >= 20/)
})

test("checkNodeRuntime handles unexpected version format gracefully", () => {
  // Should return error (treats as below 20)
  const result = checkNodeRuntime("not-a-version")
  assert.ok(typeof result === "string")
  assert.match(result, /Node\.js >= 20/)
})

// Smoke: spawn CLI with the actual Node version (which is >=20 on this machine)
// and verify it does NOT print the unsupported error and does NOT exit 1.
test("CLI help exits 0 on supported Node (no runtime error)", async () => {
  const result = spawnSync(process.execPath, [CLI, "help"], { encoding: "utf8" })
  assert.strictEqual(result.status, 0, `help should exit 0 on supported Node v${process.versions.node}`)
  assert.ok(!result.stderr.includes("Unsupported runtime"), "must not print unsupported runtime error")
})
