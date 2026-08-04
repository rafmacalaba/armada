import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { runCli, makeTempRepo, makeTempGitRepo } from "./helpers.js"
import { createWorktreeFeature } from "../src/feature-commands.js"

// ---- unit: createWorktreeFeature -------------------------------------------

test("createWorktreeFeature creates worktree, contract, entry, index, active", () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })
  const paths = createWorktreeFeature(dir, "my-feature")

  // Worktree exists
  assert.ok(existsSync(paths.worktreePath), "worktree path must exist")
  assert.strictEqual(paths.branch, "feat/my-feature")

  // Worktree has its own .git file
  assert.ok(existsSync(join(paths.worktreePath, ".git")), ".git file must exist in worktree")

  // Contract exists inside worktree
  assert.ok(existsSync(paths.contractPath), "contract must exist")
  const contractContent = readFileSync(paths.contractPath, "utf8")
  assert.match(contractContent, /# my-feature/)

  // Feature entry exists inside worktree
  assert.ok(existsSync(paths.entryPath), "entry must exist")
  const entryJson = JSON.parse(readFileSync(paths.entryPath, "utf8"))
  assert.strictEqual(entryJson.name, "my-feature")
  assert.strictEqual(entryJson.status, "open")

  // Index entry points at it
  assert.ok(existsSync(paths.indexPath), "index must exist")
  const indexJson = JSON.parse(readFileSync(paths.indexPath, "utf8"))
  const found = indexJson.find((e) => e.name === "my-feature")
  assert.ok(found, "index must contain my-feature")
  assert.strictEqual(found.status, "open")

  // Active state exists
  assert.ok(existsSync(paths.activePath), "active must exist")
  const active = JSON.parse(readFileSync(paths.activePath, "utf8"))
  assert.strictEqual(active.feature, "my-feature")

  // History exists
  const historyPath = join(paths.worktreePath, "armada", "state", "history", "my-feature.jsonl")
  assert.ok(existsSync(historyPath), "history must exist")
  const historyLine = readFileSync(historyPath, "utf8").trim()
  const historyEntry = JSON.parse(historyLine)
  assert.strictEqual(historyEntry.event, "created")
  assert.strictEqual(historyEntry.name, "my-feature")
  assert.strictEqual(historyEntry.worktree, "sandbox/my-feature")
  assert.strictEqual(historyEntry.branch, "feat/my-feature")
})

test("createWorktreeFeature twice with same name throws clean error, no clobber", () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })
  createWorktreeFeature(dir, "dup-feature")

  assert.throws(
    () => createWorktreeFeature(dir, "dup-feature"),
    /worktree or branch already exists/
  )
})

test("createWorktreeFeature outside git repo throws clear error", () => {
  const dir = makeTempRepo({ "README.md": "# not a git repo" })
  assert.throws(
    () => createWorktreeFeature(dir, "nope"),
    /not inside a git working tree/
  )
})

// ---- CLI e2e ---------------------------------------------------------------

test("CLI feature new --worktree creates worktree and prints details", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })
  const r = await runCli(["feature", "new", "foo", "--worktree", "--target", dir])
  assert.strictEqual(r.code, 0, `stderr: ${r.stderr}`)
  assert.match(r.stdout, /feature "foo" created \(worktree\)/)
  assert.match(r.stdout, /worktree/)
  assert.match(r.stdout, /branch/)

  const worktreePath = join(dir, "sandbox", "foo")
  assert.ok(existsSync(worktreePath), "worktree directory must exist")

  // Contract inside worktree
  assert.ok(existsSync(join(worktreePath, "armada", "contracts", "foo.md")), "contract must exist in worktree")
})

test("CLI feature new (no flag) still creates in-tree contract (regression guard)", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["feature", "new", "foo", "--target", dir])
  assert.strictEqual(r.code, 0, `stderr: ${r.stderr}`)
  assert.match(r.stdout, /feature "foo" created/)
  // must NOT say (worktree)
  assert.ok(!r.stdout.includes("(worktree)"), "no-flag case must not print (worktree)")
  assert.ok(existsSync(join(dir, "armada", "contracts", "foo.md")))
  assert.ok(existsSync(join(dir, "armada", "state", "features", "index.json")))
})

test("CLI feature new --worktree with --worktree before name", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })
  const r = await runCli(["feature", "new", "--worktree", "bar", "--target", dir])
  assert.strictEqual(r.code, 0, `stderr: ${r.stderr}`)
  assert.match(r.stdout, /feature "bar" created \(worktree\)/)
  assert.ok(existsSync(join(dir, "sandbox", "bar")))
})

test("CLI double --worktree call exits non-zero with 'already exists'", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })
  await runCli(["feature", "new", "baz", "--worktree", "--target", dir])
  const r = await runCli(["feature", "new", "baz", "--worktree", "--target", dir])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /already exists/)
})

test("CLI feature new --worktree outside git repo errors cleanly", async () => {
  const dir = makeTempRepo({ "README.md": "# no git" })
  const r = await runCli(["feature", "new", "nope", "--worktree", "--target", dir])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /not inside a git working tree/)
})
