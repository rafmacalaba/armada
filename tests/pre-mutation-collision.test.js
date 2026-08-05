import { test } from "node:test"
import assert from "node:assert"
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { makeTempGitRepo } from "./helpers.js"

test("checkGitClean: returns clean=true for clean repo", async () => {
  const { checkGitClean } = await import("../src/voyage/isolation.js")
  const dir = makeTempGitRepo({})
  const result = checkGitClean(dir)
  assert.strictEqual(result.clean, true)
  assert.deepStrictEqual(result.dirtyFiles, [])
  rmSync(dir, { recursive: true, force: true })
})

test("checkGitClean: returns clean=false for repo with uncommitted changes", async () => {
  const { checkGitClean } = await import("../src/voyage/isolation.js")
  const dir = makeTempGitRepo({})
  // Create an uncommitted change
  writeFileSync(join(dir, "dirty.txt"), "new content\n", "utf8")
  const result = checkGitClean(dir)
  assert.strictEqual(result.clean, false)
  assert.ok(result.dirtyFiles.length > 0, "should have dirty files")
  assert.ok(result.dirtyFiles.some((f) => f.includes("dirty.txt")), "should include dirty.txt")
  rmSync(dir, { recursive: true, force: true })
})

test("checkGitClean: returns clean=false for repo with staged changes", async () => {
  const { checkGitClean } = await import("../src/voyage/isolation.js")
  const dir = makeTempGitRepo({})
  writeFileSync(join(dir, "staged.txt"), "staged\n", "utf8")
  spawnSync("git", ["add", "staged.txt"], { cwd: dir })
  const result = checkGitClean(dir)
  assert.strictEqual(result.clean, false)
  assert.ok(result.dirtyFiles.length > 0)
  rmSync(dir, { recursive: true, force: true })
})

test("checkGitClean: handles non-git directory gracefully", async () => {
  const { checkGitClean } = await import("../src/voyage/isolation.js")
  const dir = mkdtempSync(join(tmpdir(), "nogit-"))
  const result = checkGitClean(dir)
  // Not a git repo — should return clean=true (no git = nothing to check)
  assert.strictEqual(result.clean, true)
  rmSync(dir, { recursive: true, force: true })
})

test("checkPreMutation: returns ok=true when main is clean", async () => {
  const { checkPreMutation } = await import("../src/voyage/isolation.js")
  const dir = makeTempGitRepo({})
  const result = checkPreMutation(dir)
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.reason, null)
  rmSync(dir, { recursive: true, force: true })
})

test("checkPreMutation: returns ok=false when main is dirty", async () => {
  const { checkPreMutation } = await import("../src/voyage/isolation.js")
  const dir = makeTempGitRepo({})
  writeFileSync(join(dir, "dirty.txt"), "dirty\n", "utf8")
  const result = checkPreMutation(dir)
  assert.strictEqual(result.ok, false)
  assert.ok(result.reason && result.reason.length > 0)
  assert.match(result.reason, /dirty/i)
  rmSync(dir, { recursive: true, force: true })
})

test("refuseIfDirty: throws when repo is dirty", async () => {
  const { refuseIfDirty } = await import("../src/voyage/isolation.js")
  const dir = makeTempGitRepo({})
  writeFileSync(join(dir, "dirty.txt"), "dirty\n", "utf8")
  assert.throws(() => refuseIfDirty(dir), /dirty/i)
  rmSync(dir, { recursive: true, force: true })
})

test("refuseIfDirty: does not throw when repo is clean", async () => {
  const { refuseIfDirty } = await import("../src/voyage/isolation.js")
  const dir = makeTempGitRepo({})
  assert.doesNotThrow(() => refuseIfDirty(dir))
  rmSync(dir, { recursive: true, force: true })
})
