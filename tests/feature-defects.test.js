/**
 * Regression tests for DEF-001..DEF-007.
 * Each test targets a specific defect fix.
 */
import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { runCli, makeTempRepo, makeTempGitRepo } from "./helpers.js"
import { validateName, extractFinalCriteriaEvidence, closeFeature } from "../src/feature-commands.js"

// ---- DEF-001: name validation -----------------------------------------------

test("DEF-001: validateName rejects path traversal names", () => {
  assert.throws(() => validateName("../../escape"), /invalid feature name/)
  assert.throws(() => validateName("/"), /invalid feature name/)
  assert.throws(() => validateName("foo/bar"), /invalid feature name/)
})

test("DEF-001: validateName rejects special characters and shell metacharacters", () => {
  assert.throws(() => validateName("foo~bar"), /invalid feature name/)
  assert.throws(() => validateName("foo;ls"), /invalid feature name/)
  assert.throws(() => validateName("foo`pwd`"), /invalid feature name/)
  assert.throws(() => validateName("foo$HOME"), /invalid feature name/)
  assert.throws(() => validateName("foo*bar"), /invalid feature name/)
})

test("DEF-001: validateName rejects names that are only dots", () => {
  assert.throws(() => validateName("."), /invalid feature name/)
  assert.throws(() => validateName(".."), /invalid feature name/)
})

test("DEF-001: validateName rejects names starting or ending with dot", () => {
  assert.throws(() => validateName(".hidden"), /must not start or end with/)
  assert.throws(() => validateName("trailing."), /must not start or end with/)
})

test("DEF-001: validateName rejects empty/falsy name", () => {
  assert.throws(() => validateName(""), /feature name is required/)
  assert.throws(() => validateName(null), /feature name is required/)
  assert.throws(() => validateName(undefined), /feature name is required/)
})

test("DEF-001: validateName accepts valid names", () => {
  assert.doesNotThrow(() => validateName("a"))
  assert.doesNotThrow(() => validateName("feat.a"))
  assert.doesNotThrow(() => validateName("a_b-c"))
  assert.doesNotThrow(() => validateName("my-feature"))
  assert.doesNotThrow(() => validateName("UPPER_CASE"))
})

test("DEF-001: validateName rejects name over 64 chars", () => {
  const longName = "a".repeat(65)
  assert.throws(() => validateName(longName), /must be 64 chars or fewer/)
})

test("DEF-001/006: CLI feature new with bad names rejects", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["feature", "new", "../../escape", "--target", dir])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /invalid feature name/)
})

test("DEF-001/006: CLI feature new --worktree with / in name rejects before git", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })
  const r = await runCli(["feature", "new", "foo/bar", "--worktree", "--target", dir])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /invalid feature name/)
  // No worktree should have been created
  const wt = join(dir, "sandbox", "foo", "bar")
  if (existsSync(wt)) spawnSync("git", ["worktree", "remove", "--force", wt], { cwd: dir })
  // The foo/bar worktree should not exist because name validation fires first
  assert.ok(!existsSync(join(dir, "sandbox", "foo")), "foo/ dir must not exist")
})

// ---- DEF-002: duplicate ## Final criteria ----------------------------------

test("DEF-002: extractFinalCriteriaEvidence rejects duplicate ## Final criteria", () => {
  const md = `## Final criteria
- [ ] first
  Evidence: a
## Not final
## Final criteria
- [ ] second
  Evidence: b
`
  assert.throws(
    () => extractFinalCriteriaEvidence(md),
    /multiple "## Final criteria" sections/
  )
})

test("DEF-002: extractFinalCriteriaEvidence still works with single section", () => {
  const md = `## Final criteria

- [ ] c1
  Evidence: x
- [ ] c2
  Evidence: y
`
  const result = extractFinalCriteriaEvidence(md)
  assert.strictEqual(result.length, 2)
  assert.strictEqual(result[0].evidence, "x")
  assert.strictEqual(result[1].evidence, "y")
})

// ---- DEF-003: branch deleted on close --remove -----------------------------

test("DEF-003: close --remove deletes the feature branch", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })

  // Create worktree feature
  await runCli(["feature", "new", "redo", "--worktree", "--target", dir])

  // Fill evidence
  const contractPath = join(dir, "sandbox", "redo", "armada", "contracts", "redo.md")
  let content = readFileSync(contractPath, "utf8")
  content = content.replace(/Evidence: \n/g, "Evidence: tests/evidence.js\n")
  writeFileSync(contractPath, content, "utf8")

  // Close with --remove
  const r = await runCli(["feature", "close", "redo", "--remove", "--target", dir])
  assert.strictEqual(r.code, 0, `close stderr: ${r.stderr}`)

  // Branch must NOT exist
  const branchResult = spawnSync("git", ["branch", "--list", "feat/redo"], { cwd: dir, encoding: "utf8" })
  assert.strictEqual(branchResult.status, 0)
  assert.ok(!branchResult.stdout.includes("feat/redo"), "branch feat/redo must not exist after close --remove")
})

test("DEF-003: re-registration after close --remove succeeds", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })

  await runCli(["feature", "new", "redo", "--worktree", "--target", dir])
  const contractPath = join(dir, "sandbox", "redo", "armada", "contracts", "redo.md")
  let content = readFileSync(contractPath, "utf8")
  content = content.replace(/Evidence: \n/g, "Evidence: tests/evidence.js\n")
  writeFileSync(contractPath, content, "utf8")

  await runCli(["feature", "close", "redo", "--remove", "--target", dir])

  // Re-register with same name must succeed
  const r2 = await runCli(["feature", "new", "redo", "--worktree", "--target", dir])
  assert.strictEqual(r2.code, 0, `re-register stderr: ${r2.stderr}`)
  assert.ok(existsSync(join(dir, "sandbox", "redo", "armada", "contracts", "redo.md")))

  // Clean up
  let c2 = readFileSync(join(dir, "sandbox", "redo", "armada", "contracts", "redo.md"), "utf8")
  c2 = c2.replace(/Evidence: \n/g, "Evidence: tests/evidence.js\n")
  writeFileSync(join(dir, "sandbox", "redo", "armada", "contracts", "redo.md"), c2, "utf8")
  await runCli(["feature", "close", "redo", "--remove", "--target", dir])
})

// ---- DEF-004: orphaned worktree cleanup ------------------------------------

test("DEF-004: close --remove on orphaned worktree purges registry", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })

  await runCli(["feature", "new", "orphan", "--worktree", "--target", dir])

  // Fill evidence
  const contractPath = join(dir, "sandbox", "orphan", "armada", "contracts", "orphan.md")
  let content = readFileSync(contractPath, "utf8")
  content = content.replace(/Evidence: \n/g, "Evidence: tests/evidence.js\n")
  writeFileSync(contractPath, content, "utf8")

  // Manually delete worktree directory and prune
  spawnSync("rm", ["-rf", join(dir, "sandbox", "orphan")])
  spawnSync("git", ["worktree", "prune"], { cwd: dir })

  // Registry still has entry
  const indexPath = join(dir, "armada", "state", "features", "index.json")
  const idx = JSON.parse(readFileSync(indexPath, "utf8"))
  assert.ok(idx.find((e) => e.name === "orphan"), "orphan must still be in index before close")

  // close --remove must succeed (DEF-004: tolerate missing worktree)
  const r = await runCli(["feature", "close", "orphan", "--remove", "--target", dir])
  assert.strictEqual(r.code, 0, `close stderr: ${r.stderr}`)

  // Index must not contain orphan
  const idx2 = JSON.parse(readFileSync(indexPath, "utf8"))
  assert.strictEqual(idx2.find((e) => e.name === "orphan"), undefined, "orphan must not be in index after close")

  // Per-feature file must be gone
  const featurePath = join(dir, "armada", "state", "features", "orphan.json")
  assert.ok(!existsSync(featurePath), "per-feature file must not exist")

  // History must contain shipped and removed events
  const historyPath = join(dir, "armada", "state", "history", "orphan.jsonl")
  assert.ok(existsSync(historyPath))
  const historyLines = readFileSync(historyPath, "utf8").trim().split("\n")
  const events = historyLines.map((l) => JSON.parse(l).event)
  assert.ok(events.includes("shipped"), "history must contain shipped")
  assert.ok(events.includes("removed"), "history must contain removed")
})

// ---- DEF-005: in-tree from worktree refused --------------------------------

test("DEF-005: createFeature from inside worktree throws", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })

  // Create a worktree feature
  await runCli(["feature", "new", "alpha", "--worktree", "--target", dir])
  const worktreePath = join(dir, "sandbox", "alpha")

  // Try to create in-tree feature from inside the worktree
  const r = await runCli(["feature", "new", "beta", "--target", "."], { cwd: worktreePath })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /cannot create in-tree feature from inside a worktree/)
  assert.match(r.stderr, /use --worktree or run from main repo/)

  // No registry entry should exist for beta
  const indexPath = join(dir, "armada", "state", "features", "index.json")
  const idx = JSON.parse(readFileSync(indexPath, "utf8"))
  assert.strictEqual(idx.find((e) => e.name === "beta"), undefined, "beta must not be in index")
})

// ---- DEF-006: covered by DEF-001 tests (name with / rejected) --------------

test("DEF-006: names with / are rejected up-front", async () => {
  // This is covered by DEF-001 tests above. Add a direct CLI test for completeness.
  const dir = makeTempGitRepo({ "README.md": "# test" })
  const r = await runCli(["feature", "new", "foo/bar", "--target", dir])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /invalid feature name/)
})

// ---- DEF-007: shipped state after worktree remove, not before --------------

test("DEF-007: source order — git worktree remove before markShipped", () => {
  // Read the source file and verify line ordering
  const source = readFileSync(join(process.cwd(), "src", "feature-commands.js"), "utf8")
  const lines = source.split("\n")

  let gitRemoveLine = -1
  let shippedWriteLine = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('spawnSync("git", ["worktree", "remove", "--force"')) {
      gitRemoveLine = i + 1
    }
    if (line.includes('const shippedEntry = markShipped(entry)') ||
        line.includes("// NOW write shipped state")) {
      shippedWriteLine = i + 1
    }
  }

  assert.ok(gitRemoveLine > 0, "must find git worktree remove line")
  assert.ok(shippedWriteLine > 0, "must find shipped write line")
  assert.ok(gitRemoveLine < shippedWriteLine,
    `git worktree remove (line ${gitRemoveLine}) must come before shipped write (line ${shippedWriteLine})`)
})
