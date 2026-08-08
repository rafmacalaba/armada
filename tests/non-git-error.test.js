import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, rmSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { resolveMainCheckout } from "../src/voyage/contract-gate.js"
import { resolveMainRepo } from "../src/feature-commands.js"

test("resolveMainCheckout throws clear error in non-git directory", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-nongit-"))
  // dir is not a git repo

  let stderrOut = ""
  const origError = console.error
  const origExit = process.exitCode
  console.error = (msg) => { stderrOut += msg + "\n" }

  try {
    assert.throws(
      () => resolveMainCheckout(dir),
      /not a git repository/,
      "should throw 'not a git repository'"
    )
    assert.ok(stderrOut.includes("not inside a git repository"),
      `expected stderr to mention git repository, got: ${stderrOut}`)
    assert.ok(stderrOut.includes("git init") || stderrOut.includes("armada new"),
      `expected remediation hint, got: ${stderrOut}`)
  } finally {
    console.error = origError
    process.exitCode = origExit
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
})

test("resolveMainCheckout succeeds in a real git repo", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-git-"))
  spawnSync("git", ["init", "-b", "main"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir, encoding: "utf8" })

  try {
    const result = resolveMainCheckout(dir)
    assert.ok(typeof result === "string", "should return a path string")
    assert.ok(existsSync(result), "resolved path should exist")
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
})

test("resolveMainRepo throws clear error in non-git directory", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-nongit-"))
  // dir is not a git repo

  let stderrOut = ""
  const origError = console.error
  const origExit = process.exitCode
  console.error = (msg) => { stderrOut += msg + "\n" }

  try {
    assert.throws(
      () => resolveMainRepo(dir),
      /not a git repository/,
      "should throw 'not a git repository'"
    )
    assert.ok(stderrOut.includes("not inside a git repository"),
      `expected stderr to mention git repository, got: ${stderrOut}`)
    assert.ok(stderrOut.includes("git init") || stderrOut.includes("armada new"),
      `expected remediation hint, got: ${stderrOut}`)
  } finally {
    console.error = origError
    process.exitCode = origExit
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
})

test("resolveMainRepo succeeds in a real git repo", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-git-"))
  spawnSync("git", ["init", "-b", "main"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["commit", "--allow-empty", "-m", "init"], { cwd: dir, encoding: "utf8" })

  try {
    const result = resolveMainRepo(dir)
    assert.ok(typeof result === "string", "should return a path string")
    assert.ok(existsSync(result), "resolved path should exist")
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
})
