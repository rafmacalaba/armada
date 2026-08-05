import { test } from "node:test"
import assert from "node:assert"
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, mkdirSync } from "node:fs"
import { join, basename } from "node:path"
import { tmpdir } from "node:os"

function initGitRepo(dir) {
  spawnSync("git", ["init"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir, encoding: "utf8" })
  writeFileSync(join(dir, "README.md"), "# test\n")
  spawnSync("git", ["add", "README.md"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["commit", "-m", "init"], { cwd: dir, encoding: "utf8" })
}

test("each voyage worktree has its own branch", () => {
  const dir = mkdtempSync(join(tmpdir(), "iso-"))
  initGitRepo(dir)

  const wtA = join(dir, "sandbox", "voyage-x")
  const wtB = join(dir, "sandbox", "voyage-y")

  spawnSync("git", ["worktree", "add", "-b", "feat/voyage-x", wtA], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["worktree", "add", "-b", "feat/voyage-y", wtB], { cwd: dir, encoding: "utf8" })

  // Branch check
  const branchA = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: wtA, encoding: "utf8" }).stdout.trim()
  const branchB = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: wtB, encoding: "utf8" }).stdout.trim()

  assert.strictEqual(branchA, "feat/voyage-x")
  assert.strictEqual(branchB, "feat/voyage-y")
  assert.notStrictEqual(branchA, branchB)

  // Cleanup
  spawnSync("git", ["worktree", "remove", "--force", wtA], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["worktree", "remove", "--force", wtB], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/voyage-x"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/voyage-y"], { cwd: dir, encoding: "utf8" })
  rmSync(dir, { recursive: true, force: true })
})

test("each voyage worktree has its own state directory", async () => {
  const { createVoyageState, writeState, readState } = await import("../src/voyage/lifecycle.js")
  const dir = mkdtempSync(join(tmpdir(), "iso-"))
  initGitRepo(dir)

  const wtA = join(dir, "sandbox", "voyage-a")
  const wtB = join(dir, "sandbox", "voyage-b")
  spawnSync("git", ["worktree", "add", "-b", "feat/voyage-a", wtA], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["worktree", "add", "-b", "feat/voyage-b", wtB], { cwd: dir, encoding: "utf8" })

  // Write state to each
  await writeState(wtA, createVoyageState({ voyage: "voyage-a", worktree: "sandbox/voyage-a" }))
  await writeState(wtB, createVoyageState({ voyage: "voyage-b", worktree: "sandbox/voyage-b" }))

  // Verify state file exists in each
  assert.ok(existsSync(join(wtA, "armada", "state", "voyage.json")))
  assert.ok(existsSync(join(wtB, "armada", "state", "voyage.json")))

  // Read back: each gets its own state
  assert.strictEqual(readState(wtA).voyage, "voyage-a")
  assert.strictEqual(readState(wtB).voyage, "voyage-b")

  // Cleanup
  spawnSync("git", ["worktree", "remove", "--force", wtA], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["worktree", "remove", "--force", wtB], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/voyage-a"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/voyage-b"], { cwd: dir, encoding: "utf8" })
  rmSync(dir, { recursive: true, force: true })
})

test("each voyage worktree has its own contracts and ledgers dirs", () => {
  const dir = mkdtempSync(join(tmpdir(), "iso-"))
  initGitRepo(dir)

  const wtA = join(dir, "sandbox", "voyage-c")
  spawnSync("git", ["worktree", "add", "-b", "feat/voyage-c", wtA], { cwd: dir, encoding: "utf8" })

  // Create contract and ledger in voyage worktree
  mkdirSync(join(wtA, "armada", "contracts"), { recursive: true })
  mkdirSync(join(wtA, "armada", "ledgers"), { recursive: true })
  mkdirSync(join(wtA, "armada", "e2e"), { recursive: true })

  writeFileSync(join(wtA, "armada", "contracts", "voyage-c.md"), "# contract\n")
  writeFileSync(join(wtA, "armada", "ledgers", "DEFECTS.md"), "# defects\n")
  writeFileSync(join(wtA, "armada", "e2e", "smoke.test.js"), "// e2e\n")

  // Verify: files exist in worktree
  assert.ok(existsSync(join(wtA, "armada", "contracts", "voyage-c.md")))
  assert.ok(existsSync(join(wtA, "armada", "ledgers", "DEFECTS.md")))
  assert.ok(existsSync(join(wtA, "armada", "e2e", "smoke.test.js")))

  // Verify: main checkout does NOT have these files
  assert.ok(!existsSync(join(dir, "armada", "contracts", "voyage-c.md")),
    "main checkout must not have voyage contracts")
  assert.ok(!existsSync(join(dir, "armada", "ledgers", "DEFECTS.md")),
    "main checkout must not have voyage ledgers")
  assert.ok(!existsSync(join(dir, "armada", "e2e", "smoke.test.js")),
    "main checkout must not have voyage e2e")

  // Cleanup
  spawnSync("git", ["worktree", "remove", "--force", wtA], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/voyage-c"], { cwd: dir, encoding: "utf8" })
  rmSync(dir, { recursive: true, force: true })
})

test("cross-voyage reads blocked: voyage A cannot read voyage B state", async () => {
  const { createVoyageState, writeState, readState } = await import("../src/voyage/lifecycle.js")
  const dir = mkdtempSync(join(tmpdir(), "iso-"))
  initGitRepo(dir)

  const wtA = join(dir, "sandbox", "voyage-alpha")
  const wtB = join(dir, "sandbox", "voyage-beta")
  spawnSync("git", ["worktree", "add", "-b", "feat/voyage-alpha", wtA], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["worktree", "add", "-b", "feat/voyage-beta", wtB], { cwd: dir, encoding: "utf8" })

  // Write state to voyage A only
  await writeState(wtA, createVoyageState({ voyage: "voyage-alpha" }))

  // Voyage A can read its state
  assert.strictEqual(readState(wtA).voyage, "voyage-alpha")

  // Voyage B cannot read voyage A's state (different worktree)
  assert.strictEqual(readState(wtB), null, "voyage B must not see voyage A's state")

  // Cleanup
  spawnSync("git", ["worktree", "remove", "--force", wtA], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["worktree", "remove", "--force", wtB], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/voyage-alpha"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/voyage-beta"], { cwd: dir, encoding: "utf8" })
  rmSync(dir, { recursive: true, force: true })
})
