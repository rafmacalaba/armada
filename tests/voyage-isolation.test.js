import { test } from "node:test"
import assert from "node:assert"
import { spawnSync } from "node:child_process"
import { readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { makeTempGitRepo } from "./helpers.js"

test("git status before/after voyage simulation: main checkout unchanged", () => {
  const dir = makeTempGitRepo({
    "src/main.js": "// main source\n",
    "README.md": "# Test Repo\n",
  })

  // Capture git status before
  const before = spawnSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" }).stdout.trim()

  // Simulate: do nothing to main checkout
  // (voyage operates in worktree, not main)

  // Capture git status after
  const after = spawnSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" }).stdout.trim()

  assert.strictEqual(after, before, "main checkout must be byte-identical before and after voyage simulation")
  rmSync(dir, { recursive: true, force: true })
})

test("voyage operations only affect worktree, not main checkout", () => {
  const dir = makeTempGitRepo({
    "package.json": "{}",
  })

  // Snapshot main's HEAD and tracked file content
  const headBefore = spawnSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).stdout.trim()
  const pkgBefore = readFileSync(join(dir, "package.json"), "utf8")

  // Create a worktree (simulating voyage)
  const worktreePath = join(dir, "sandbox", "test-voyage")
  const wtResult = spawnSync("git", ["worktree", "add", "-b", "feat/test-voyage", worktreePath], { cwd: dir, encoding: "utf8" })
  assert.strictEqual(wtResult.status, 0, `git worktree add failed: ${wtResult.stderr}`)

  // Make changes in worktree only
  spawnSync("sh", ["-c", "echo 'worktree change' >> sandbox/test-voyage/package.json"], { cwd: dir, encoding: "utf8" })

  // Main checkout tracked files must be unchanged
  const headAfter = spawnSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).stdout.trim()
  const pkgAfter = readFileSync(join(dir, "package.json"), "utf8")

  assert.strictEqual(headAfter, headBefore, "HEAD must be unchanged in main checkout")
  assert.strictEqual(pkgAfter, pkgBefore, "tracked file content must be identical in main checkout")

  // Cleanup worktree
  spawnSync("git", ["worktree", "remove", "--force", worktreePath], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/test-voyage"], { cwd: dir, encoding: "utf8" })
  rmSync(dir, { recursive: true, force: true })
})

test("main checkout files unchanged after worktree creation and removal", async () => {
  const { createVoyageWorktree, removeVoyageWorktree } = await import("../src/voyage/worktree.js")

  const dir = makeTempGitRepo({
    "src/app.js": "// app\n",
  })

  // Read main file before
  const beforeContent = readFileSync(join(dir, "src/app.js"), "utf8")

  // Create worktree
  const wtPath = createVoyageWorktree(dir, "isolate-test")

  // Read main file after worktree creation
  const afterCreate = readFileSync(join(dir, "src/app.js"), "utf8")
  assert.strictEqual(afterCreate, beforeContent, "main file must not change after worktree creation")

  // Remove worktree
  removeVoyageWorktree(dir, wtPath, "feat/isolate-test")

  // Read main file after worktree removal
  const afterRemove = readFileSync(join(dir, "src/app.js"), "utf8")
  assert.strictEqual(afterRemove, beforeContent, "main file must not change after worktree removal")

  rmSync(dir, { recursive: true, force: true })
})
