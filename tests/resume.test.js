/**
 * tests/resume.test.js — CLI tests for `armada resume` (the canonical name)
 * and the deprecated `armada reconcile` alias.
 */

import { test } from "node:test"
import assert from "node:assert"
import { spawnSync } from "node:child_process"
import { join } from "node:path"

const CLI = join(process.cwd(), "src", "cli.js")

function runCli(args) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env },
  })
  return {
    code: result.status ?? null,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

test("resume --help exits 0 and prints help text", () => {
  const { code, stdout } = runCli(["resume", "--help"])
  assert.strictEqual(code, 0)
  assert.ok(stdout.length > 0, "stdout should have help text")
})

test("reconcile --help prints deprecation hint to stderr and exits 1", () => {
  const { code, stderr } = runCli(["reconcile", "--help"])
  assert.strictEqual(code, 1)
  assert.ok(stderr.includes("deprecated"), "stderr should contain 'deprecated'")
  assert.ok(stderr.includes("armada resume"), "stderr should mention 'armada resume'")
})

test("reconcile (no args) prints deprecation hint to stderr and still runs the underlying job", () => {
  const { code, stdout, stderr } = runCli(["reconcile"])
  assert.ok(stderr.includes("deprecated"), "stderr should contain 'deprecated'")
  assert.ok(stderr.includes("armada resume"), "stderr should mention 'armada resume'")
  // The underlying job should still run (prints resume output to stdout)
  assert.ok(
    stdout.includes("resume:") || stdout.includes("drifts") || stdout.includes("drift"),
    "stdout should contain reconciler output"
  )
  assert.strictEqual(code, 1, "should exit 1 due to deprecation")
})
