import { test } from "node:test"
import assert from "node:assert"
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { makeTempGitRepo } from "./helpers.js"

test("findOrphanWorktrees: detects worktree dirs not in git worktree list", async () => {
  const { findOrphanWorktrees } = await import("../src/voyage/worktree.js")
  const dir = makeTempGitRepo({})

  // Create a sandbox directory with a fake worktree that's not tracked by git
  const { mkdirSync } = await import("node:fs")
  mkdirSync(join(dir, "sandbox", "orphan-voyage"), { recursive: true })
  writeFileSync(join(dir, "sandbox", "orphan-voyage", "README.md"), "# orphan\n")

  // Also create a real git worktree to ensure it's NOT flagged
  const realPath = join(dir, "sandbox", "real-voyage")
  spawnSync("git", ["worktree", "add", "-b", "feat/real-voyage", realPath], { cwd: dir, encoding: "utf8" })

  const orphans = findOrphanWorktrees(dir)

  const orphanPaths = orphans.map((p) => p.replace(dir + "/", ""))
  assert.ok(orphanPaths.includes("sandbox/orphan-voyage"), "orphan-voyage should be detected")
  assert.ok(!orphanPaths.some((p) => p.includes("real-voyage")), "real-voyage should NOT be orphan")

  // Cleanup
  spawnSync("git", ["worktree", "remove", "--force", realPath], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/real-voyage"], { cwd: dir, encoding: "utf8" })
  rmSync(dir, { recursive: true, force: true })
})

test("findOrphanWorktrees: returns empty when no sandbox dir", async () => {
  const { findOrphanWorktrees } = await import("../src/voyage/worktree.js")
  const dir = mkdtempSync(join(tmpdir(), "orphan-test-"))
  const orphans = findOrphanWorktrees(dir)
  assert.deepStrictEqual(orphans, [])
  rmSync(dir, { recursive: true, force: true })
})

test("recoverOrphanVoyage: creates state file for orphan worktree", async () => {
  const { findOrphanWorktrees, createVoyageWorktree } = await import("../src/voyage/worktree.js")
  const { createVoyageState, writeState, readState } = await import("../src/voyage/lifecycle.js")
  const dir = makeTempGitRepo({})

  // Create an orphan worktree by creating the directory manually
  const { mkdirSync } = await import("node:fs")
  const orphanDir = join(dir, "sandbox", "lost-voyage")
  mkdirSync(orphanDir, { recursive: true })
  writeFileSync(join(orphanDir, "package.json"), "{}")

  // Detect orphan
  const orphans = findOrphanWorktrees(dir)
  assert.strictEqual(orphans.length, 1)

  // Recover: create state for orphan
  const name = "lost-voyage"
  const state = createVoyageState({ voyage: name, worktree: `sandbox/${name}` })
  await writeState(orphans[0], state)

  const recovered = readState(orphans[0])
  assert.strictEqual(recovered.voyage, "lost-voyage")
  assert.strictEqual(recovered.status, "active")

  rmSync(dir, { recursive: true, force: true })
})

test("listVoyageWorktrees: returns all git worktrees", async () => {
  const { listVoyageWorktrees, createVoyageWorktree, removeVoyageWorktree } = await import("../src/voyage/worktree.js")
  const dir = mkdtempSync(join(tmpdir(), "orphan-wt-list-"))

  // Manual git init with guaranteed commit
  spawnSync("git", ["init"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir, encoding: "utf8" })
  writeFileSync(join(dir, "initial.txt"), "initial\n")
  spawnSync("git", ["add", "initial.txt"], { cwd: dir, encoding: "utf8" })
  const commit = spawnSync("git", ["commit", "-m", "init"], { cwd: dir, encoding: "utf8" })
  assert.strictEqual(commit.status, 0, `git commit failed: ${commit.stderr}`)

  const before = listVoyageWorktrees(dir)
  assert.ok(before.length >= 1, "should have at least main worktree")

  const wtPath = createVoyageWorktree(dir, "list-test")
  const after = listVoyageWorktrees(dir)
  assert.ok(after.length >= 2, "should have main + voyage worktree")

  const voyageWt = after.find((w) => w.branch === "feat/list-test")
  assert.ok(voyageWt, "voyage worktree should be listed")
  // macOS /tmp is a symlink to /private/tmp; compare realpaths
  const { realpathSync } = await import("node:fs")
  assert.strictEqual(realpathSync(voyageWt.path), realpathSync(wtPath))

  removeVoyageWorktree(dir, wtPath, "feat/list-test")
  const afterRemove = listVoyageWorktrees(dir)
  assert.ok(afterRemove.length >= 1)

  rmSync(dir, { recursive: true, force: true })
})
