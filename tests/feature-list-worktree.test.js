import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, realpathSync, mkdtempSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { runCli, makeTempGitRepo } from "./helpers.js"
import { resolveMainRepo } from "../src/feature-commands.js"

// macOS /tmp is a symlink to /private/tmp. git rev-parse returns realpath,
// so resolve for comparison.
function real(s) { return realpathSync(s) }

// ---- unit: resolveMainRepo ------------------------------------------------

test("resolveMainRepo from inside worktree returns main repo path", () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })
  // Create a worktree to test from inside it
  spawnSync("git", ["worktree", "add", "-b", "feat/unit-test", join(dir, "sandbox", "unit-test")], { cwd: dir, encoding: "utf8" })

  const worktreePath = join(dir, "sandbox", "unit-test")
  const result = resolveMainRepo(worktreePath)
  assert.strictEqual(real(result), real(dir), "resolveMainRepo from worktree must return main repo root")
})

test("resolveMainRepo from main repo returns main repo path", () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })
  const result = resolveMainRepo(dir)
  assert.strictEqual(real(result), real(dir), "resolveMainRepo from main repo must return itself")
})

test("resolveMainRepo outside git repo falls back to cwd", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-nogit-"))
  const result = resolveMainRepo(dir)
  assert.strictEqual(real(result), real(dir), "resolveMainRepo outside git must fall back to cwd")
})

// ---- CLI: list with worktree + in-tree features ---------------------------

test("CLI feature list shows '-' for worktree+branch on in-tree features", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })
  await runCli(["feature", "new", "alpha", "--target", dir])

  const r = await runCli(["feature", "list", "--target", dir])
  assert.strictEqual(r.code, 0, `stderr: ${r.stderr}`)
  // Must contain alpha row
  assert.match(r.stdout, /alpha/)
  // Must show NAME, STATUS, CONTRACT, WORKTREE, BRANCH headers
  assert.match(r.stdout, /NAME\s+STATUS\s+CONTRACT\s+WORKTREE\s+BRANCH/)
  // alpha should show '-' for worktree and branch columns
  assert.match(r.stdout, /alpha\s+open\s+armada\/contracts\/alpha\.md\s+-\s+-/)
})

test("CLI feature list shows worktree+branch for worktree features", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })
  await runCli(["feature", "new", "beta", "--worktree", "--target", dir])

  const r = await runCli(["feature", "list", "--target", dir])
  assert.strictEqual(r.code, 0, `stderr: ${r.stderr}`)
  assert.match(r.stdout, /beta/)
  // Must show WORKTREE and BRANCH headers
  assert.match(r.stdout, /WORKTREE\s+BRANCH/)
  // beta should show worktree path and branch
  assert.match(r.stdout, /beta\s+open\s+armada\/contracts\/beta\.md\s+sandbox\/beta\s+feat\/beta/)
})

test("CLI feature list shows both in-tree and worktree features", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })
  await runCli(["feature", "new", "alpha", "--target", dir])
  await runCli(["feature", "new", "beta", "--worktree", "--target", dir])

  const r = await runCli(["feature", "list", "--target", dir])
  assert.strictEqual(r.code, 0, `stderr: ${r.stderr}`)
  // alpha row present with '-'
  assert.match(r.stdout, /alpha\s+open\s+armada\/contracts\/alpha\.md\s+-\s+-/)
  // beta row present with worktree/branch
  assert.match(r.stdout, /beta\s+open\s+armada\/contracts\/beta\.md\s+sandbox\/beta\s+feat\/beta/)
  // Sorted by name
  const alphaIdx = r.stdout.indexOf("alpha")
  const betaIdx = r.stdout.indexOf("beta")
  assert.ok(alphaIdx < betaIdx, "features must be sorted by name (alpha before beta)")
})

test("CLI feature list from inside worktree shows same global list", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })
  await runCli(["feature", "new", "alpha", "--target", dir])
  await runCli(["feature", "new", "beta", "--worktree", "--target", dir])

  const worktreePath = join(dir, "sandbox", "beta")
  // List from inside the worktree, using --target=.
  const r = await runCli(["feature", "list", "--target", "."], { cwd: worktreePath })
  assert.strictEqual(r.code, 0, `stderr: ${r.stderr}`)
  // Must contain both features
  assert.match(r.stdout, /alpha/)
  assert.match(r.stdout, /beta/)
  // beta should still show worktree/branch
  assert.match(r.stdout, /beta\s+open\s+armada\/contracts\/beta\.md\s+sandbox\/beta\s+feat\/beta/)
})

test("CLI feature list column header order is NAME STATUS CONTRACT WORKTREE BRANCH", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })
  await runCli(["feature", "new", "alpha", "--target", dir])
  const r = await runCli(["feature", "list", "--target", dir])

  // Get the header line (first non-empty line)
  const lines = r.stdout.split("\n").filter((l) => l.trim() !== "")
  const headerLine = lines[0]
  const nameIdx = headerLine.indexOf("NAME")
  const statusIdx = headerLine.indexOf("STATUS")
  const contractIdx = headerLine.indexOf("CONTRACT")
  const worktreeIdx = headerLine.indexOf("WORKTREE")
  const branchIdx = headerLine.indexOf("BRANCH")

  assert.ok(nameIdx >= 0, "NAME header must be present")
  assert.ok(statusIdx > nameIdx, "STATUS must come after NAME")
  assert.ok(contractIdx > statusIdx, "CONTRACT must come after STATUS")
  assert.ok(worktreeIdx > contractIdx, "WORKTREE must come after CONTRACT")
  assert.ok(branchIdx > worktreeIdx, "BRANCH must come after WORKTREE")
})

test("CLI feature list first 3 columns byte-identical to old format for in-tree", async () => {
  const dir = makeTempGitRepo({})
  await runCli(["feature", "new", "foo", "--target", dir])

  const r = await runCli(["feature", "list", "--target", dir])
  assert.strictEqual(r.code, 0, `stderr: ${r.stderr}`)

  // The first 3 columns for foo must be: "foo       open    armada/contracts/foo.md  "
  // Verify the old 3-column layout is present as a prefix of each data row
  // NAME (padded to 8)  STATUS (padded to 6)  CONTRACT (padded to width)
  const match = r.stdout.match(/^foo\s{6,}open\s{3,}armada\/contracts\/foo\.md\s{2,}/m)
  assert.ok(match, "first 3 columns must match old padding layout, got: " + r.stdout)
})

test("CLI feature list sorts features alphabetically", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })
  await runCli(["feature", "new", "zulu", "--target", dir])
  await runCli(["feature", "new", "alpha", "--target", dir])
  await runCli(["feature", "new", "mike", "--target", dir])

  const r = await runCli(["feature", "list", "--target", dir])
  assert.strictEqual(r.code, 0, `stderr: ${r.stderr}`)

  const alphaIdx = r.stdout.indexOf("alpha")
  const mikeIdx = r.stdout.indexOf("mike")
  const zuluIdx = r.stdout.indexOf("zulu")
  assert.ok(alphaIdx < mikeIdx, "alpha must come before mike")
  assert.ok(mikeIdx < zuluIdx, "mike must come before zulu")
})
