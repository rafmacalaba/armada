/**
 * tests/resume.test.js — CLI tests for `armada resume` (canonical)
 * and `armada reconcile` (documented alias).
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

test("reconcile --help exits 0 and prints help text (documented alias)", () => {
  const { code, stdout } = runCli(["reconcile", "--help"])
  assert.strictEqual(code, 0)
  assert.ok(stdout.length > 0, "stdout should have help text")
})

test("reconcile (no args) runs the underlying resume engine", () => {
  const { stdout } = runCli(["reconcile"])
  // Underlying resume engine prints resume output to stdout
  assert.ok(
    stdout.includes("resume:") || stdout.includes("drifts") || stdout.includes("drift") || stdout.includes("{"),
    "stdout should contain reconciler output"
  )
  // Exit code reflects actual outcome, not forced non-zero
})
