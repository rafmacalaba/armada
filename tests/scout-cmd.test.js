import { test } from "node:test"
import assert from "node:assert"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const CLI = join(process.cwd(), "src", "cli.js")

function runCli(args) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    cwd: process.cwd(),
  })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

// Phase 2: armada scout is hard-removed (no switch case — falls through to unknown command)
test("scout: any args print unknown command and exit 1", () => {
  const result = runCli(["scout", "src/auth/middleware.js"])
  assert.strictEqual(result.code, 1)
  assert.match(result.stderr, /Unknown command/)
})

test("scout: --help prints unknown command and exits 1", () => {
  const result = runCli(["scout", "--help"])
  assert.strictEqual(result.code, 1)
  assert.match(result.stderr, /Unknown command/)
})

test("scout: -h prints unknown command and exits 1", () => {
  const result = runCli(["scout", "-h"])
  assert.strictEqual(result.code, 1)
  assert.match(result.stderr, /Unknown command/)
})

test("scout: no args prints unknown command and exits 1", () => {
  const result = runCli(["scout"])
  assert.strictEqual(result.code, 1)
  assert.match(result.stderr, /Unknown command/)
})
