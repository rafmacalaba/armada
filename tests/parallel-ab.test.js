import { test } from "node:test"
import assert from "node:assert"
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, readFileSync, rmSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

test("two parallel voyages in disjoint worktrees do not conflict", () => {
  const dir = mkdtempSync(join(tmpdir(), "parallel-ab-"))

  // Manual git init
  spawnSync("git", ["init"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir, encoding: "utf8" })
  writeFileSync(join(dir, "base.txt"), "base\n")
  spawnSync("git", ["add", "base.txt"], { cwd: dir, encoding: "utf8" })
  const commit = spawnSync("git", ["commit", "-m", "init"], { cwd: dir, encoding: "utf8" })
  assert.strictEqual(commit.status, 0, `git commit failed: ${commit.stderr}`)

  // Create voyage A worktree
  const wtA = join(dir, "sandbox", "voyage-a")
  spawnSync("git", ["worktree", "add", "-b", "feat/voyage-a", wtA], { cwd: dir, encoding: "utf8" })

  // Create voyage B worktree
  const wtB = join(dir, "sandbox", "voyage-b")
  spawnSync("git", ["worktree", "add", "-b", "feat/voyage-b", wtB], { cwd: dir, encoding: "utf8" })

  // Write in voyage A
  writeFileSync(join(wtA, "voyage-a-file.txt"), "A\n")

  // Write in voyage B
  writeFileSync(join(wtB, "voyage-b-file.txt"), "B\n")

  // Verify: voyage A only has its file, not B's
  const aFiles = readdirSync(wtA)
  assert.ok(aFiles.some((f) => f === "voyage-a-file.txt"), "voyage A should have A's file")
  assert.ok(!aFiles.some((f) => f === "voyage-b-file.txt"), "voyage A must NOT have B's file")

  // Verify: voyage B only has its file, not A's
  const bFiles = readdirSync(wtB)
  assert.ok(bFiles.some((f) => f === "voyage-b-file.txt"), "voyage B should have B's file")
  assert.ok(!bFiles.some((f) => f === "voyage-a-file.txt"), "voyage B must NOT have A's file")

  // Verify: main checkout only has base.txt
  const mainFiles = readdirSync(dir)
  assert.ok(mainFiles.some((f) => f === "base.txt"), "main should have base.txt")
  assert.ok(!mainFiles.some((f) => f === "voyage-a-file.txt"), "main must NOT have voyage A file")
  assert.ok(!mainFiles.some((f) => f === "voyage-b-file.txt"), "main must NOT have voyage B file")

  // Cleanup
  spawnSync("git", ["worktree", "remove", "--force", wtA], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["worktree", "remove", "--force", wtB], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/voyage-a"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/voyage-b"], { cwd: dir, encoding: "utf8" })
  rmSync(dir, { recursive: true, force: true })
})

test("parallel voyages have independent state files", async () => {
  const { createVoyageState, writeState, readState } = await import("../src/voyage/lifecycle.js")
  const dir = mkdtempSync(join(tmpdir(), "parallel-state-"))

  // Manual git init
  spawnSync("git", ["init"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir, encoding: "utf8" })
  writeFileSync(join(dir, "init.txt"), "init\n")
  spawnSync("git", ["add", "init.txt"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["commit", "-m", "init"], { cwd: dir, encoding: "utf8" })

  // Create worktrees
  const wtA = join(dir, "sandbox", "alpha")
  const wtB = join(dir, "sandbox", "beta")
  spawnSync("git", ["worktree", "add", "-b", "feat/alpha", wtA], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["worktree", "add", "-b", "feat/beta", wtB], { cwd: dir, encoding: "utf8" })

  // Write independent states
  const stateA = createVoyageState({ voyage: "alpha", worktree: "sandbox/alpha", branch: "feat/alpha" })
  const stateB = createVoyageState({ voyage: "beta", worktree: "sandbox/beta", branch: "feat/beta" })

  await Promise.all([
    writeState(wtA, stateA),
    writeState(wtB, stateB),
  ])

  // Read back: each voyage sees only its own state
  const readA = readState(wtA)
  const readB = readState(wtB)

  assert.strictEqual(readA.voyage, "alpha")
  assert.strictEqual(readB.voyage, "beta")

  // Cleanup
  spawnSync("git", ["worktree", "remove", "--force", wtA], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["worktree", "remove", "--force", wtB], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/alpha"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/beta"], { cwd: dir, encoding: "utf8" })
  rmSync(dir, { recursive: true, force: true })
})
