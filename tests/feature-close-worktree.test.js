import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { runCli, makeTempRepo, makeTempGitRepo } from "./helpers.js"

// ---- CLI e2e: close --remove on worktree feature ---------------------------

/**
 * Helper: fill evidence in the contract at the given path.
 * Replaces all `Evidence: \n` lines with `Evidence: tests/evidence.js\n`.
 */
function fillEvidence(contractPath) {
  let content = readFileSync(contractPath, "utf8")
  content = content.replace(/Evidence: \n/g, "Evidence: tests/evidence.js\n")
  writeFileSync(contractPath, content, "utf8")
}

test("close --remove on worktree feature removes worktree and cleans registry", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })

  // Create worktree feature
  const r1 = await runCli(["feature", "new", "beta", "--worktree", "--target", dir])
  assert.strictEqual(r1.code, 0, `new stderr: ${r1.stderr}`)

  // Fill evidence in contract (inside worktree)
  const contractPath = join(dir, "sandbox", "beta", "armada", "contracts", "beta.md")
  assert.ok(existsSync(contractPath), "contract must exist")
  fillEvidence(contractPath)

  // Close with --remove
  const r2 = await runCli(["feature", "close", "beta", "--remove", "--target", dir])
  assert.strictEqual(r2.code, 0, `close stderr: ${r2.stderr}`)
  assert.match(r2.stdout, /shipped: "beta"/)
  assert.match(r2.stdout, /worktree removed: sandbox\/beta/)
  assert.match(r2.stdout, /shippedAt:/)

  // Worktree directory must NOT exist
  const worktreePath = join(dir, "sandbox", "beta")
  assert.ok(!existsSync(worktreePath), "worktree directory must not exist after removal")

  // Global index must NOT contain beta
  const indexPath = join(dir, "armada", "state", "features", "index.json")
  const index = JSON.parse(readFileSync(indexPath, "utf8"))
  const betaEntry = index.find((e) => e.name === "beta")
  assert.strictEqual(betaEntry, undefined, "beta must not be in index after close --remove")

  // Per-feature file must NOT exist
  const featurePath = join(dir, "armada", "state", "features", "beta.json")
  assert.ok(!existsSync(featurePath), "per-feature file must not exist after close --remove")

  // History must contain removed event
  const historyPath = join(dir, "armada", "state", "history", "beta.jsonl")
  assert.ok(existsSync(historyPath), "history file must exist")
  const historyLines = readFileSync(historyPath, "utf8").trim().split("\n")
  const removedEntry = JSON.parse(historyLines[historyLines.length - 1])
  assert.strictEqual(removedEntry.event, "removed")
  assert.strictEqual(removedEntry.name, "beta")
  assert.strictEqual(removedEntry.worktree, "sandbox/beta")
  assert.strictEqual(removedEntry.branch, "feat/beta")
})

test("close without --remove on worktree feature keeps worktree", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })

  // Create worktree feature
  const r1 = await runCli(["feature", "new", "gamma", "--worktree", "--target", dir])
  assert.strictEqual(r1.code, 0, `new stderr: ${r1.stderr}`)

  // Fill evidence
  const contractPath = join(dir, "sandbox", "gamma", "armada", "contracts", "gamma.md")
  fillEvidence(contractPath)

  // Close WITHOUT --remove
  const r2 = await runCli(["feature", "close", "gamma", "--target", dir])
  assert.strictEqual(r2.code, 0, `close stderr: ${r2.stderr}`)
  assert.match(r2.stdout, /shipped: "gamma"/)
  // Must NOT contain "worktree removed"
  const hasRemovedLine = r2.stdout.includes("worktree removed")
  assert.ok(!hasRemovedLine, "must NOT print 'worktree removed' when --remove not set")

  // Worktree directory must STILL exist
  const worktreePath = join(dir, "sandbox", "gamma")
  assert.ok(existsSync(worktreePath), "worktree must still exist without --remove")

  // Global index must show shipped with worktree field still set
  const indexPath = join(dir, "armada", "state", "features", "index.json")
  const index = JSON.parse(readFileSync(indexPath, "utf8"))
  const gammaEntry = index.find((e) => e.name === "gamma")
  assert.ok(gammaEntry, "gamma must be in index")
  assert.strictEqual(gammaEntry.status, "shipped")
  assert.strictEqual(gammaEntry.worktree, "sandbox/gamma")
})

test("close --remove on in-tree feature succeeds silently (no worktree to remove)", async () => {
  const dir = makeTempRepo({})

  // Create in-tree feature
  await runCli(["feature", "new", "alpha", "--target", dir])

  // Fill evidence
  const contractPath = join(dir, "armada", "contracts", "alpha.md")
  fillEvidence(contractPath)

  // Close with --remove
  const r = await runCli(["feature", "close", "alpha", "--remove", "--target", dir])
  assert.strictEqual(r.code, 0, `close stderr: ${r.stderr}`)
  assert.match(r.stdout, /shipped: "alpha"/)
  // Must NOT contain "worktree removed"
  const hasRemovedLine = r.stdout.includes("worktree removed")
  assert.ok(!hasRemovedLine, "in-tree close --remove must not print 'worktree removed'")

  // In-tree files still present
  assert.ok(existsSync(contractPath), "contract must still exist")
  assert.ok(existsSync(join(dir, "armada", "state", "features", "index.json")), "index must exist")
  assert.ok(existsSync(join(dir, "armada", "state", "features", "alpha.json")), "feature file must exist")

  // Index entry shows shipped
  const index = JSON.parse(readFileSync(join(dir, "armada", "state", "features", "index.json"), "utf8"))
  const alphaEntry = index.find((e) => e.name === "alpha")
  assert.ok(alphaEntry, "alpha must be in index")
  assert.strictEqual(alphaEntry.status, "shipped")
})

test("close with missing evidence fails", async () => {
  const dir = makeTempRepo({})

  // Create feature without filling evidence
  await runCli(["feature", "new", "nope", "--target", dir])

  const r = await runCli(["feature", "close", "nope", "--target", dir])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /refusing to close/)
  assert.match(r.stderr, /lack evidence/)
})

test("close --remove then git worktree list does not include the worktree", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })

  // Create worktree feature
  await runCli(["feature", "new", "beta", "--worktree", "--target", dir])

  // Fill evidence
  const contractPath = join(dir, "sandbox", "beta", "armada", "contracts", "beta.md")
  fillEvidence(contractPath)

  // Close with --remove
  const r = await runCli(["feature", "close", "beta", "--remove", "--target", dir])
  assert.strictEqual(r.code, 0, `close stderr: ${r.stderr}`)

  // git worktree list — must NOT include sandbox/beta
  const listResult = spawnSync("git", ["worktree", "list"], { cwd: dir, encoding: "utf8" })
  assert.strictEqual(listResult.status, 0, `git worktree list stderr: ${listResult.stderr}`)
  assert.ok(!listResult.stdout.includes("sandbox/beta"), "git worktree list must NOT include sandbox/beta")
})

test("after close --remove, feature list does not show the removed feature", async () => {
  const dir = makeTempGitRepo({ "README.md": "# test" })

  // Create worktree feature
  await runCli(["feature", "new", "beta", "--worktree", "--target", dir])

  // Fill evidence
  const contractPath = join(dir, "sandbox", "beta", "armada", "contracts", "beta.md")
  fillEvidence(contractPath)

  // Close with --remove
  await runCli(["feature", "close", "beta", "--remove", "--target", dir])

  // Feature list must NOT show beta
  const r = await runCli(["feature", "list", "--target", dir])
  assert.strictEqual(r.code, 0, `list stderr: ${r.stderr}`)
  // Should not contain "beta" in the feature listing
  // "No features registered" or the table headers — but no beta row
  assert.ok(!r.stdout.match(/^beta\b/m), "feature list must NOT show beta")
})
