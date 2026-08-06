/**
 * fleet-discover tests — unit + CLI e2e
 */
import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"

import { runCli } from "./helpers.js"

// We'll import the module after we create it.
// For now, define the tests with dynamic imports so they don't bomb before the module exists.

let listOrphans, renderDiscoverTable, renderDiscoverJson, registerOrphans
let validateRunEntry, getStoreDir

async function loadModule() {
  const mod = await import("../src/fleet-discover.js")
  listOrphans = mod.listOrphans
  renderDiscoverTable = mod.renderDiscoverTable
  renderDiscoverJson = mod.renderDiscoverJson
  registerOrphans = mod.registerOrphans
  const ft = await import("../src/fleet-tracker.js")
  validateRunEntry = ft.validateRunEntry
  getStoreDir = ft.getStoreDir
}

function setupRepo() {
  const t = mkdtempSync(join(tmpdir(), "armada-fd-unit-"))
  // Create sandbox dir
  mkdirSync(join(t, "sandbox"), { recursive: true })
  return t
}

function setupOrphan(repoDir, name, branch, gitdirPath) {
  const worktreePath = join(repoDir, "sandbox", name)
  mkdirSync(worktreePath, { recursive: true })

  // .git file pointing to gitdir
  const resolvedGitdir = gitdirPath ? resolve(gitdirPath) : join(repoDir, ".git", "worktrees", name)
  writeFileSync(join(worktreePath, ".git"), `gitdir: ${resolvedGitdir}\n`)

  // gitdir HEAD
  mkdirSync(resolvedGitdir, { recursive: true })
  writeFileSync(join(resolvedGitdir, "HEAD"), `ref: refs/heads/${branch}\n`)

  // armada/REQUIREMENTS.md
  mkdirSync(join(worktreePath, "armada"), { recursive: true })
  writeFileSync(join(worktreePath, "armada", "REQUIREMENTS.md"), "# Test\n")
}

function setupRunsDir(repoDir) {
  const runsDir = mkdtempSync(join(tmpdir(), "armada-fd-runs-"))
  return runsDir
}

describe("fleet-discover unit", () => {
  let repoDir, runsDir

  beforeEach(async () => {
    repoDir = setupRepo()
    runsDir = setupRunsDir()
    await loadModule()
  })

  afterEach(() => {
    try { rmSync(repoDir, { recursive: true }) } catch {}
    try { rmSync(runsDir, { recursive: true }) } catch {}
  })

  it("listOrphans: returns [] when sandbox/ missing", () => {
    const t = mkdtempSync(join(tmpdir(), "armada-fd-nosandbox-"))
    try {
      const orphans = listOrphans({ repoDir: t, runsDir })
      assert.deepStrictEqual(orphans, [])
    } finally {
      rmSync(t, { recursive: true })
    }
  })

  it("listOrphans: returns [] when sandbox/ exists but empty", () => {
    const orphans = listOrphans({ repoDir, runsDir })
    assert.deepStrictEqual(orphans, [])
  })

  it("listOrphans: skips non-worktree dir (no .git file)", () => {
    // Create a dir in sandbox that has armada/REQUIREMENTS.md but no .git file
    const dir = join(repoDir, "sandbox", "no-git")
    mkdirSync(dir, { recursive: true })
    mkdirSync(join(dir, "armada"), { recursive: true })
    writeFileSync(join(dir, "armada", "REQUIREMENTS.md"), "# test\n")

    const orphans = listOrphans({ repoDir, runsDir })
    assert.deepStrictEqual(orphans, [])
  })

  it("listOrphans: skips dir without armada/REQUIREMENTS.md", () => {
    const dir = join(repoDir, "sandbox", "no-contract")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, ".git"), "gitdir: /some/path\n")

    const orphans = listOrphans({ repoDir, runsDir })
    assert.deepStrictEqual(orphans, [])
  })

  it("listOrphans: skips already-registered orphans (run JSON exists)", () => {
    const session = "feat-registered"
    setupOrphan(repoDir, session, "feat/some-branch")

    // Write a run JSON to simulate already-registered
    mkdirSync(runsDir, { recursive: true })
    writeFileSync(join(runsDir, `${session}.json`), JSON.stringify({ session }))

    const orphans = listOrphans({ repoDir, runsDir })
    assert.deepStrictEqual(orphans, [])
  })

  it("listOrphans: surfaces orphan with proper fields", () => {
    const session = "feat-x"
    const gitdirPath = join(repoDir, "gitdirs", session)
    setupOrphan(repoDir, session, "feat/feat-x", gitdirPath)

    const orphans = listOrphans({ repoDir, runsDir })
    assert.strictEqual(orphans.length, 1)

    const o = orphans[0]
    assert.strictEqual(o.session, "feat-x")
    assert.strictEqual(o.lane, join(repoDir, "sandbox", "feat-x"))
    assert.strictEqual(o.branch, "feat/feat-x")
    assert.ok(o.contract.endsWith(join("armada", "REQUIREMENTS.md")), `contract: ${o.contract}`)
    assert.strictEqual(o.contract, join(repoDir, "sandbox", "feat-x", "armada", "REQUIREMENTS.md"))
    assert.strictEqual(o.worktreePath, join(repoDir, "sandbox", "feat-x"))
  })

  it("listOrphans: branch fallback to feat/<session> when .git unparseable", () => {
    const session = "feat-x"
    // Create worktree with garbage .git content
    const worktreePath = join(repoDir, "sandbox", session)
    mkdirSync(worktreePath, { recursive: true })
    writeFileSync(join(worktreePath, ".git"), "garbage content not parseable\n")
    mkdirSync(join(worktreePath, "armada"), { recursive: true })
    writeFileSync(join(worktreePath, "armada", "REQUIREMENTS.md"), "# Test\n")

    const orphans = listOrphans({ repoDir, runsDir })
    assert.strictEqual(orphans.length, 1)
    assert.strictEqual(orphans[0].branch, "feat/feat-x")
  })

  it("listOrphans: --repo override", () => {
    // Create two repos, one with orphan, one without
    const otherRepo = mkdtempSync(join(tmpdir(), "armada-fd-other-"))
    try {
      mkdirSync(join(otherRepo, "sandbox"), { recursive: true })
      setupOrphan(otherRepo, "feat-other", "feat/feat-other")

      // Pass otherRepo — should find orphan there
      const orphans = listOrphans({ repoDir: otherRepo, runsDir })
      assert.strictEqual(orphans.length, 1)
      assert.strictEqual(orphans[0].session, "feat-other")

      // Our original repoDir has no orphan — should be empty
      const orphans2 = listOrphans({ repoDir, runsDir })
      assert.strictEqual(orphans2.length, 0)
    } finally {
      rmSync(otherRepo, { recursive: true })
    }
  })

  it("renderDiscoverTable: header + data row", () => {
    const orphans = [{
      session: "feat-x",
      lane: "/abs/path/sandbox/feat-x",
      branch: "feat/feat-x",
      contract: "/abs/path/sandbox/feat-x/armada/REQUIREMENTS.md",
      worktreePath: "/abs/path/sandbox/feat-x",
    }]

    const out = renderDiscoverTable(orphans)
    assert.ok(out.includes("SESSION"), `missing SESSION header: ${out}`)
    assert.ok(out.includes("LANE"), `missing LANE header: ${out}`)
    assert.ok(out.includes("BRANCH"), `missing BRANCH header: ${out}`)
    assert.ok(out.includes("CONTRACT"), `missing CONTRACT header: ${out}`)
    assert.ok(out.includes("STATUS"), `missing STATUS header: ${out}`)
    assert.ok(out.includes("feat-x"), `missing session name: ${out}`)
    assert.ok(out.includes("untracked"), `missing untracked status: ${out}`)
  })

  it("renderDiscoverTable: zero orphans", () => {
    const out = renderDiscoverTable([])
    assert.strictEqual(out, "no orphan worktrees")
  })

  it("renderDiscoverJson: shape", () => {
    const orphans = [{
      session: "feat-x",
      lane: "/abs/sandbox/feat-x",
      branch: "feat/x",
      contract: "/abs/sandbox/feat-x/armada/REQUIREMENTS.md",
      worktreePath: "/abs/sandbox/feat-x",
    }]

    const json = renderDiscoverJson(orphans)
    const parsed = JSON.parse(json)
    assert.ok(Array.isArray(parsed))
    assert.strictEqual(parsed.length, 1)
    assert.strictEqual(parsed[0].session, "feat-x")
    assert.strictEqual(parsed[0].lane, "/abs/sandbox/feat-x")
    assert.strictEqual(parsed[0].branch, "feat/x")
    assert.strictEqual(parsed[0].contract, "/abs/sandbox/feat-x/armada/REQUIREMENTS.md")
  })

  it("renderDiscoverJson: empty case is []", () => {
    const json = renderDiscoverJson([])
    assert.strictEqual(json, "[]")
  })

  it("registerOrphans: writes run JSON with ACTIVE status", async () => {
    const orphans = [{
      session: "feat-reg-1",
      lane: join(repoDir, "sandbox", "feat-reg-1"),
      branch: "feat/feat-reg-1",
      contract: join(repoDir, "sandbox", "feat-reg-1", "armada", "REQUIREMENTS.md"),
      worktreePath: join(repoDir, "sandbox", "feat-reg-1"),
    }]

    const results = await registerOrphans(orphans, { storeDir: runsDir })
    assert.strictEqual(results.length, 1)
    assert.strictEqual(results[0].session, "feat-reg-1")
    assert.strictEqual(results[0].status, "registered")

    // Verify file written
    const filePath = join(runsDir, "feat-reg-1.json")
    assert.ok(existsSync(filePath), `file not written: ${filePath}`)

    const data = JSON.parse(readFileSync(filePath, "utf8"))
    assert.strictEqual(data.session, "feat-reg-1")
    assert.strictEqual(data.status, "ACTIVE")
    assert.strictEqual(data.lastNextAction, "registered via fleet discover — no live session")
    assert.strictEqual(data.lane, join(repoDir, "sandbox", "feat-reg-1"))
    assert.strictEqual(data.branch, "feat/feat-reg-1")
    assert.strictEqual(data.contract, join(repoDir, "sandbox", "feat-reg-1", "armada", "REQUIREMENTS.md"))
    // startedAt and lastHeartbeatAt set
    assert.ok(data.startedAt, "missing startedAt")
    assert.ok(data.lastHeartbeatAt, "missing lastHeartbeatAt")
  })

  it("registerOrphans: idempotent — second call skips", async () => {
    const orphans = [{
      session: "feat-reg-2",
      lane: join(repoDir, "sandbox", "feat-reg-2"),
      branch: "feat/feat-reg-2",
      contract: join(repoDir, "sandbox", "feat-reg-2", "armada", "REQUIREMENTS.md"),
      worktreePath: join(repoDir, "sandbox", "feat-reg-2"),
    }]

    // First call
    const r1 = await registerOrphans(orphans, { storeDir: runsDir })
    assert.strictEqual(r1[0].status, "registered")

    // Read startedAt from first write
    const data1 = JSON.parse(readFileSync(join(runsDir, "feat-reg-2.json"), "utf8"))
    const startedAt1 = data1.startedAt

    // Second call — should skip
    const r2 = await registerOrphans(orphans, { storeDir: runsDir })
    assert.strictEqual(r2[0].status, "skipped")

    // File should not be overwritten — same startedAt
    const data2 = JSON.parse(readFileSync(join(runsDir, "feat-reg-2.json"), "utf8"))
    assert.strictEqual(data2.startedAt, startedAt1)
  })

  it("registerOrphans: written entry passes validateRunEntry", async () => {
    const orphans = [{
      session: "feat-reg-3",
      lane: join(repoDir, "sandbox", "feat-reg-3"),
      branch: "feat/feat-reg-3",
      contract: join(repoDir, "sandbox", "feat-reg-3", "armada", "REQUIREMENTS.md"),
      worktreePath: join(repoDir, "sandbox", "feat-reg-3"),
    }]

    await registerOrphans(orphans, { storeDir: runsDir })
    const data = JSON.parse(readFileSync(join(runsDir, "feat-reg-3.json"), "utf8"))

    // Should not throw
    assert.doesNotThrow(() => validateRunEntry(data))
  })

  it("registerOrphans: multiple orphans", async () => {
    const orphans = [
      { session: "a", lane: "/a", branch: "feat/a", contract: "/a/REQUIREMENTS.md", worktreePath: "/a" },
      { session: "b", lane: "/b", branch: "feat/b", contract: "/b/REQUIREMENTS.md", worktreePath: "/b" },
    ]

    const results = await registerOrphans(orphans, { storeDir: runsDir })
    assert.strictEqual(results.length, 2)
    assert.ok(existsSync(join(runsDir, "a.json")))
    assert.ok(existsSync(join(runsDir, "b.json")))
  })
})

describe("fleet-discover CLI e2e", () => {
  let repoDir, runsDir

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), "armada-fd-cli-"))
    runsDir = mkdtempSync(join(tmpdir(), "armada-fd-cli-runs-"))
    mkdirSync(join(repoDir, "sandbox"), { recursive: true })
  })

  afterEach(() => {
    try { rmSync(repoDir, { recursive: true }) } catch {}
    try { rmSync(runsDir, { recursive: true }) } catch {}
  })

  function createOrphan(repoDir, name) {
    const worktreePath = join(repoDir, "sandbox", name)
    mkdirSync(worktreePath, { recursive: true })
    const gitdirPath = join(repoDir, "gitdirs", name)
    mkdirSync(gitdirPath, { recursive: true })
    writeFileSync(join(worktreePath, ".git"), `gitdir: ${gitdirPath}\n`)
    writeFileSync(join(gitdirPath, "HEAD"), `ref: refs/heads/feat/${name}\n`)
    mkdirSync(join(worktreePath, "armada"), { recursive: true })
    writeFileSync(join(worktreePath, "armada", "REQUIREMENTS.md"), "# Test\n")
  }

  it("table output with one orphan", async () => {
    createOrphan(repoDir, "feat-x")
    const { code, stdout, stderr } = await runCli(["fleet", "discover"], {
      cwd: repoDir,
      env: { ARMADA_RUNS_DIR: runsDir },
    })
    assert.strictEqual(code, 0, `exit code: ${code}, stderr: ${stderr}`)
    assert.ok(stdout.includes("SESSION"), stdout)
    assert.ok(stdout.includes("LANE"), stdout)
    assert.ok(stdout.includes("BRANCH"), stdout)
    assert.ok(stdout.includes("CONTRACT"), stdout)
    assert.ok(stdout.includes("STATUS"), stdout)
    assert.ok(stdout.includes("feat-x"), stdout)
    assert.ok(stdout.includes("untracked"), stdout)
  })

  it("--json flag", async () => {
    createOrphan(repoDir, "feat-x")
    const { code, stdout, stderr } = await runCli(["fleet", "discover", "--json"], {
      cwd: repoDir,
      env: { ARMADA_RUNS_DIR: runsDir },
    })
    assert.strictEqual(code, 0, `exit code: ${code}, stderr: ${stderr}`)
    const parsed = JSON.parse(stdout)
    assert.ok(Array.isArray(parsed))
    assert.strictEqual(parsed.length, 1)
    assert.strictEqual(parsed[0].session, "feat-x")
    assert.strictEqual(parsed[0].branch, "feat/feat-x")
  })

  it("--register --json writes run JSON", async () => {
    createOrphan(repoDir, "feat-x")
    const { code, stdout, stderr } = await runCli(["fleet", "discover", "--register", "--json"], {
      cwd: repoDir,
      env: { ARMADA_RUNS_DIR: runsDir },
    })
    assert.strictEqual(code, 0, `exit code: ${code}, stderr: ${stderr}`)
    // Run JSON should exist
    const runPath = join(runsDir, "feat-x.json")
    assert.ok(existsSync(runPath), `run JSON not written at ${runPath}`)
    const data = JSON.parse(readFileSync(runPath, "utf8"))
    assert.strictEqual(data.status, "ACTIVE")
    assert.strictEqual(data.lastNextAction, "registered via fleet discover — no live session")
  })

  it("--register --json is idempotent", async () => {
    createOrphan(repoDir, "feat-x")
    const opts = { cwd: repoDir, env: { ARMADA_RUNS_DIR: runsDir } }

    // First run
    const r1 = await runCli(["fleet", "discover", "--register", "--json"], opts)
    assert.strictEqual(r1.code, 0, `first run: ${r1.code} ${r1.stderr}`)
    const data1 = JSON.parse(readFileSync(join(runsDir, "feat-x.json"), "utf8"))
    const ts1 = data1.startedAt

    // Second run — skip
    const r2 = await runCli(["fleet", "discover", "--register", "--json"], opts)
    assert.strictEqual(r2.code, 0, `second run: ${r2.code} ${r2.stderr}`)

    const data2 = JSON.parse(readFileSync(join(runsDir, "feat-x.json"), "utf8"))
    assert.strictEqual(data2.startedAt, ts1, "startedAt should not change on second run")
  })

  it("--help flag", async () => {
    const { code, stdout, stderr } = await runCli(["fleet", "discover", "--help"], {
      cwd: repoDir,
      env: { ARMADA_RUNS_DIR: runsDir },
    })
    assert.strictEqual(code, 0, `exit code: ${code}, stderr: ${stderr}`)
    assert.ok(stdout.includes("--json"), stdout)
    assert.ok(stdout.includes("--register"), stdout)
    assert.ok(stdout.includes("--repo"), stdout)
    assert.ok(stdout.includes("discover"), stdout)
  })

  it("no orphans prints 'no orphan worktrees' and exits 0", async () => {
    const { code, stdout, stderr } = await runCli(["fleet", "discover"], {
      cwd: repoDir,
      env: { ARMADA_RUNS_DIR: runsDir },
    })
    assert.strictEqual(code, 0, `exit code: ${code}, stderr: ${stderr}`)
    assert.strictEqual(stdout.trim(), "no orphan worktrees")
  })

  it("already-registered orphan not listed", async () => {
    createOrphan(repoDir, "feat-x")

    // Pre-write run JSON
    mkdirSync(runsDir, { recursive: true })
    const entry = {
      session: "feat-x",
      lane: "/tmp/x",
      branch: "feat/x",
      contract: "/tmp/x/contract.md",
      startedAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      lastNextAction: "",
      lastEvidence: [],
      phaseStatuses: {},
      tmuxPaneTail: "",
      cost: 0,
      status: "ACTIVE",
    }
    writeFileSync(join(runsDir, "feat-x.json"), JSON.stringify(entry))

    const { code, stdout } = await runCli(["fleet", "discover"], {
      cwd: repoDir,
      env: { ARMADA_RUNS_DIR: runsDir },
    })
    assert.strictEqual(code, 0)
    assert.strictEqual(stdout.trim(), "no orphan worktrees")
  })

  it("skips non-worktree and no-contract dirs", async () => {
    createOrphan(repoDir, "feat-x")
    // Add a non-worktree dir
    const bad1 = join(repoDir, "sandbox", "no-git")
    mkdirSync(bad1, { recursive: true })
    mkdirSync(join(bad1, "armada"), { recursive: true })
    writeFileSync(join(bad1, "armada", "REQUIREMENTS.md"), "# nope")
    // Add a dir without contract
    const bad2 = join(repoDir, "sandbox", "no-contract")
    mkdirSync(bad2, { recursive: true })
    writeFileSync(join(bad2, ".git"), "gitdir: /blah\n")

    const { code, stdout } = await runCli(["fleet", "discover"], {
      cwd: repoDir,
      env: { ARMADA_RUNS_DIR: runsDir },
    })
    assert.strictEqual(code, 0)
    // Only feat-x should appear
    const lines = stdout.split("\n").filter((l) => l.includes("feat-x"))
    assert.strictEqual(lines.length, 1)
  })

  it("--repo flag scans alternate repo", async () => {
    const otherRepo = mkdtempSync(join(tmpdir(), "armada-fd-alt-"))
    try {
      mkdirSync(join(otherRepo, "sandbox"), { recursive: true })
      createOrphan(otherRepo, "feat-alt")

      const { code, stdout } = await runCli(["fleet", "discover", "--repo", otherRepo], {
        cwd: repoDir,
        env: { ARMADA_RUNS_DIR: runsDir },
      })
      assert.strictEqual(code, 0)
      assert.ok(stdout.includes("feat-alt"), stdout)
    } finally {
      rmSync(otherRepo, { recursive: true })
    }
  })

  it("--repo with non-existent path exits 1", async () => {
    const { code, stdout, stderr } = await runCli(["fleet", "discover", "--repo", "/nonexistent/path/12345"], {
      cwd: repoDir,
      env: { ARMADA_RUNS_DIR: runsDir },
    })
    assert.strictEqual(code, 1, `expected exit 1, got ${code}: ${stdout} ${stderr}`)
  })
})
