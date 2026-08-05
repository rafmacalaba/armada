import { test } from "node:test"
import assert from "node:assert"
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, mkdirSync } from "node:fs"
import { join, basename } from "node:path"
import { tmpdir } from "node:os"
import { makeTempGitRepo } from "./helpers.js"

function initGitRepo(dir) {
  spawnSync("git", ["init"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir, encoding: "utf8" })
  writeFileSync(join(dir, "README.md"), "# test\n")
  spawnSync("git", ["add", "README.md"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["commit", "-m", "init"], { cwd: dir, encoding: "utf8" })
}

// -- pre-mutation collision (from pre-mutation-collision.test.js) --

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

// -- orphan recovery (from orphan-recovery.test.js) --

test("findOrphanWorktrees: detects worktree dirs not in git worktree list", async () => {
  const { findOrphanWorktrees } = await import("../src/voyage/worktree.js")
  const dir = makeTempGitRepo({ "README.md": "# test\n" })

  mkdirSync(join(dir, "sandbox", "orphan-voyage"), { recursive: true })
  writeFileSync(join(dir, "sandbox", "orphan-voyage", "README.md"), "# orphan\n")

  const realPath = join(dir, "sandbox", "real-voyage")
  spawnSync("git", ["worktree", "add", "-b", "feat/real-voyage", realPath], { cwd: dir, encoding: "utf8" })

  const orphans = findOrphanWorktrees(dir)

  const orphanPaths = orphans.map((p) => p.replace(dir + "/", ""))
  assert.ok(orphanPaths.includes("sandbox/orphan-voyage"), "orphan-voyage should be detected")
  assert.ok(!orphanPaths.some((p) => p.includes("real-voyage")), "real-voyage should NOT be orphan")

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
  const { findOrphanWorktrees } = await import("../src/voyage/worktree.js")
  const { createVoyageState, writeState, readState } = await import("../src/voyage/lifecycle.js")
  const dir = makeTempGitRepo({ "README.md": "# test\n" })

  const orphanDir = join(dir, "sandbox", "lost-voyage")
  mkdirSync(orphanDir, { recursive: true })
  writeFileSync(join(orphanDir, "package.json"), "{}")

  const orphans = findOrphanWorktrees(dir)
  assert.strictEqual(orphans.length, 1)

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
  const { realpathSync } = await import("node:fs")
  assert.strictEqual(realpathSync(voyageWt.path), realpathSync(wtPath))

  removeVoyageWorktree(dir, wtPath, "feat/list-test")
  const afterRemove = listVoyageWorktrees(dir)
  assert.ok(afterRemove.length >= 1)

  rmSync(dir, { recursive: true, force: true })
})

// -- parallel A/B (from parallel-ab.test.js) --

test("two parallel voyages in disjoint worktrees do not conflict", () => {
  const dir = mkdtempSync(join(tmpdir(), "parallel-ab-"))

  spawnSync("git", ["init"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.email", "t@t"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["config", "user.name", "t"], { cwd: dir, encoding: "utf8" })
  writeFileSync(join(dir, "base.txt"), "base\n")
  spawnSync("git", ["add", "base.txt"], { cwd: dir, encoding: "utf8" })
  const commit = spawnSync("git", ["commit", "-m", "init"], { cwd: dir, encoding: "utf8" })
  assert.strictEqual(commit.status, 0, `git commit failed: ${commit.stderr}`)

  const wtA = join(dir, "sandbox", "voyage-a")
  spawnSync("git", ["worktree", "add", "-b", "feat/voyage-a", wtA], { cwd: dir, encoding: "utf8" })

  const wtB = join(dir, "sandbox", "voyage-b")
  spawnSync("git", ["worktree", "add", "-b", "feat/voyage-b", wtB], { cwd: dir, encoding: "utf8" })

  writeFileSync(join(wtA, "voyage-a-file.txt"), "A\n")
  writeFileSync(join(wtB, "voyage-b-file.txt"), "B\n")

  const aFiles = readdirSync(wtA)
  assert.ok(aFiles.some((f) => f === "voyage-a-file.txt"), "voyage A should have A's file")
  assert.ok(!aFiles.some((f) => f === "voyage-b-file.txt"), "voyage A must NOT have B's file")

  const bFiles = readdirSync(wtB)
  assert.ok(bFiles.some((f) => f === "voyage-b-file.txt"), "voyage B should have B's file")
  assert.ok(!bFiles.some((f) => f === "voyage-a-file.txt"), "voyage B must NOT have A's file")

  const mainFiles = readdirSync(dir)
  assert.ok(mainFiles.some((f) => f === "base.txt"), "main should have base.txt")
  assert.ok(!mainFiles.some((f) => f === "voyage-a-file.txt"), "main must NOT have voyage A file")
  assert.ok(!mainFiles.some((f) => f === "voyage-b-file.txt"), "main must NOT have voyage B file")

  spawnSync("git", ["worktree", "remove", "--force", wtA], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["worktree", "remove", "--force", wtB], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/voyage-a"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/voyage-b"], { cwd: dir, encoding: "utf8" })
  rmSync(dir, { recursive: true, force: true })
})

// -- per-voyage isolation (from per-voyage-isolation.test.js) --

test("each voyage worktree has its own branch", () => {
  const dir = mkdtempSync(join(tmpdir(), "iso-"))
  initGitRepo(dir)

  const wtA = join(dir, "sandbox", "voyage-x")
  const wtB = join(dir, "sandbox", "voyage-y")

  spawnSync("git", ["worktree", "add", "-b", "feat/voyage-x", wtA], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["worktree", "add", "-b", "feat/voyage-y", wtB], { cwd: dir, encoding: "utf8" })

  const branchA = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: wtA, encoding: "utf8" }).stdout.trim()
  const branchB = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: wtB, encoding: "utf8" }).stdout.trim()

  assert.strictEqual(branchA, "feat/voyage-x")
  assert.strictEqual(branchB, "feat/voyage-y")
  assert.notStrictEqual(branchA, branchB)

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

  await writeState(wtA, createVoyageState({ voyage: "voyage-a", worktree: "sandbox/voyage-a" }))
  await writeState(wtB, createVoyageState({ voyage: "voyage-b", worktree: "sandbox/voyage-b" }))

  assert.ok(existsSync(join(wtA, "armada", "state", "voyage.json")))
  assert.ok(existsSync(join(wtB, "armada", "state", "voyage.json")))

  assert.strictEqual(readState(wtA).voyage, "voyage-a")
  assert.strictEqual(readState(wtB).voyage, "voyage-b")

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

  mkdirSync(join(wtA, "armada", "contracts"), { recursive: true })
  mkdirSync(join(wtA, "armada", "ledgers"), { recursive: true })
  mkdirSync(join(wtA, "armada", "e2e"), { recursive: true })

  writeFileSync(join(wtA, "armada", "contracts", "voyage-c.md"), "# contract\n")
  writeFileSync(join(wtA, "armada", "ledgers", "DEFECTS.md"), "# defects\n")
  writeFileSync(join(wtA, "armada", "e2e", "smoke.test.js"), "// e2e\n")

  assert.ok(existsSync(join(wtA, "armada", "contracts", "voyage-c.md")))
  assert.ok(existsSync(join(wtA, "armada", "ledgers", "DEFECTS.md")))
  assert.ok(existsSync(join(wtA, "armada", "e2e", "smoke.test.js")))

  assert.ok(!existsSync(join(dir, "armada", "contracts", "voyage-c.md")),
    "main checkout must not have voyage contracts")
  assert.ok(!existsSync(join(dir, "armada", "ledgers", "DEFECTS.md")),
    "main checkout must not have voyage ledgers")
  assert.ok(!existsSync(join(dir, "armada", "e2e", "smoke.test.js")),
    "main checkout must not have voyage e2e")

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

  await writeState(wtA, createVoyageState({ voyage: "voyage-alpha" }))

  assert.strictEqual(readState(wtA).voyage, "voyage-alpha")
  assert.strictEqual(readState(wtB), null, "voyage B must not see voyage A's state")

  spawnSync("git", ["worktree", "remove", "--force", wtA], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["worktree", "remove", "--force", wtB], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/voyage-alpha"], { cwd: dir, encoding: "utf8" })
  spawnSync("git", ["branch", "-D", "feat/voyage-beta"], { cwd: dir, encoding: "utf8" })
  rmSync(dir, { recursive: true, force: true })
})
