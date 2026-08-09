import { test } from "node:test"
import assert from "node:assert"
import { existsSync, mkdtempSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runCli, spawnCli, makeTempGitRepo, makeBin, makeTempRepo } from "./helpers.js"

function stubBins() {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  symlinkSync("/usr/bin/git", join(binDir, "git"))
  // Ensure /usr/bin is in PATH so git helpers (git-core, etc.) are found
  return `${binDir}:/usr/bin`
}

// ---- Phase 1: armada voyage <name> is canonical entry ----

test("voyage <name> — rejects path-like args", async () => {
  for (const bad of ["sandbox/myfeature", "my..feature", "-myfeature"]) {
    const r = await runCli(["voyage", bad])
    assert.strictEqual(r.code, 1, `${bad}: expected exit 1, got ${r.code}`)
    assert.match(r.stderr, /armada voyage: expected <name>, got <lane-path>/, `${bad}: no migration hint. stderr=${r.stderr}`)
  }
})

test("voyage with no name exits 1 with error", async () => {
  const r = await runCli(["voyage"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /armada voyage: name is required/)
})

test("voyage <name> creates worktree and boots lane", async () => {
  const binPath = stubBins()
  const repoDir = makeTempGitRepo({
    "readme.md": "# test",
    "armada/armada.yaml": "project:\n  name: test\n  stack: {}\nteam:\n  - role: orchestrator\n    model: opencode-go/minimax-m3\n    enabled: true\n",
  })
  const r = await spawnCli(["voyage", "myfeature"], {
    env: { PATH: binPath, HOME: mkdtempSync(join(tmpdir(), "armada-home-")) },
    cwd: repoDir,
  })
  assert.strictEqual(r.code, 0, `stderr: ${r.stderr}\nstdout: ${r.stdout}`)
  assert.match(r.stdout, /session/)
  assert.match(r.stdout, /prompt registered/)
  const worktreePath = join(repoDir, "sandbox", "myfeature")
  assert.ok(existsSync(worktreePath), `worktree missing: ${worktreePath}`)
  assert.ok(existsSync(join(worktreePath, "armada", "REQUIREMENTS.md")), "canonical voyage contract missing")
  assert.ok(!existsSync(join(worktreePath, "armada", "contracts", "myfeature.md")), "voyage must not use secondary contract")
  assert.ok(existsSync(join(worktreePath, ".opencode", "agent", "commodore.md")), "voyage Commodore missing")
  const activePath = join(worktreePath, "armada", "state", "active.json")
  assert.ok(existsSync(activePath), "active.json missing")
})

test("voyage <name> reuses existing worktree", async () => {
  const binPath = stubBins()
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const homeDir = mkdtempSync(join(tmpdir(), "armada-home-"))

  // First voyage — creates worktree
  const r1 = await spawnCli(["voyage", "sharedlane"], {
    env: { PATH: binPath, HOME: homeDir },
    cwd: repoDir,
  })
  assert.strictEqual(r1.code, 0, `first voyage: ${r1.stderr}`)
  const worktreePath = join(repoDir, "sandbox", "sharedlane")
  assert.ok(existsSync(worktreePath))

  // Second voyage — reuses
  const r2 = await spawnCli(["voyage", "sharedlane"], {
    env: { PATH: binPath, HOME: homeDir },
    cwd: repoDir,
  })
  assert.strictEqual(r2.code, 0, `second voyage: ${r2.stderr}`)
  assert.match(r2.stdout, /session/)
})

test("voyage --from-path extracts basename", async () => {
  const binPath = stubBins()
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await spawnCli(["voyage", "--from-path", "/some/path/myfeat"], {
    env: { PATH: binPath, HOME: mkdtempSync(join(tmpdir(), "armada-home-")) },
    cwd: repoDir,
  })
  assert.strictEqual(r.code, 0, `stderr: ${r.stderr}\nstdout: ${r.stdout}`)
  assert.match(r.stdout, /session/)
  const worktreePath = join(repoDir, "sandbox", "myfeat")
  assert.ok(existsSync(worktreePath), "worktree not created via --from-path")
})

test("voyage --print-attach prints command and exits 0", async () => {
  const repoDir = makeTempGitRepo({})
  const r = await runCli(["voyage", "--print-attach", "myfeature"], { cwd: repoDir })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /tmux attach -t/)
})

test("voyage --help prints usage", async () => {
  const r = await runCli(["voyage", "--help"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /Usage:/)
  assert.match(r.stdout, /armada voyage/)
})

// ---- Phase 2: voyage list / close ----

test("voyage list shows features", async () => {
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const binPath = stubBins()
  // Create worktree features via voyage (in cwd=repoDir)
  await spawnCli(["voyage", "foo"], { env: { PATH: binPath, HOME: mkdtempSync(join(tmpdir(), "armada-home-")) }, cwd: repoDir })
  await spawnCli(["voyage", "bar"], { env: { PATH: binPath, HOME: mkdtempSync(join(tmpdir(), "armada-home-")) }, cwd: repoDir })

  const r = await runCli(["voyage", "list", "--target", repoDir])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /foo/)
  assert.match(r.stdout, /bar/)
  assert.match(r.stdout, /open/)
})

test("voyage list with no features says so", async () => {
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await runCli(["voyage", "list", "--target", repoDir])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /No features/)
})

test("voyage close without evidence fails", async () => {
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const binPath = stubBins()
  await spawnCli(["voyage", "foo"], { env: { PATH: binPath, HOME: mkdtempSync(join(tmpdir(), "armada-home-")) }, cwd: repoDir })

  const r = await runCli(["voyage", "close", "foo", "--target", repoDir])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /refusing to close/)
})

test("voyage close with evidence succeeds", async () => {
  const { readFileSync, writeFileSync } = await import("node:fs")
  const { join } = await import("node:path")
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const binPath = stubBins()
  await spawnCli(["voyage", "foo"], { env: { PATH: binPath, HOME: mkdtempSync(join(tmpdir(), "armada-home-")) }, cwd: repoDir })

   const contractPath = join(repoDir, "sandbox", "foo", "armada", "REQUIREMENTS.md")
  let contract = readFileSync(contractPath, "utf8")
  contract = contract.replace(/Evidence: \n/g, "Evidence: src/foo.js:42\n")
  writeFileSync(contractPath, contract, "utf8")

  const r = await runCli(["voyage", "close", "foo", "--target", repoDir])
  assert.strictEqual(r.code, 0, `stderr: ${r.stderr}`)
  assert.match(r.stdout, /shipped/)
})

test("voyage close nonexistent fails", async () => {
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await runCli(["voyage", "close", "nonexistent", "--target", repoDir])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /not found/)
})

// ---- Phase 3: deprecation aliases ----

test("feature new prints deprecation warning", async () => {
  // Run in non-git dir so it fails fast; just check the warning
  const dir = makeTempRepo({})
  const r = await runCli(["feature", "new", "foo", "--target", dir])
  assert.match(r.stderr, /armada feature new: deprecated; use 'armada voyage <name>'/)
})

test("feature list prints deprecation warning and delegates", async () => {
  const { spawnSync } = await import("node:child_process")
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  // Create feature via voyage (which creates worktree + registers globally)
  const binPath = stubBins()
  // Create worktree feature via voyage
  await spawnCli(["voyage", "flist1"], {
    env: { PATH: binPath, HOME: mkdtempSync(join(tmpdir(), "armada-home-")) },
    cwd: repoDir,
  })
  const r = await runCli(["feature", "list", "--target", repoDir])
  assert.match(r.stderr, /armada feature list: deprecated; use 'armada voyage list'/)
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /flist1/)
})

test("feature close prints deprecation warning and delegates", async () => {
  const { readFileSync, writeFileSync } = await import("node:fs")
  const { join } = await import("node:path")
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const binPath = stubBins()
  // Create worktree feature via voyage
  await spawnCli(["voyage", "fclose1"], {
    env: { PATH: binPath, HOME: mkdtempSync(join(tmpdir(), "armada-home-")) },
    cwd: repoDir,
  })

  const contractPath = join(repoDir, "sandbox", "fclose1", "armada", "REQUIREMENTS.md")
  let contract = readFileSync(contractPath, "utf8")
  contract = contract.replace(/Evidence: \n/g, "Evidence: x\n")
  writeFileSync(contractPath, contract, "utf8")

  const r = await runCli(["feature", "close", "fclose1", "--target", repoDir])
  assert.match(r.stderr, /armada feature close: deprecated; use 'armada voyage close <name>'/)
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /shipped/)
})
