import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, realpathSync } from "node:fs"
import { join, basename } from "node:path"
import { tmpdir } from "node:os"
import { makeBin, runCli, makeTempGitRepo } from "./helpers.js"

// Fake tmux that records every invocation we care about to a state dir
// passed via FAKE_TMUX_STATE. We capture:
//   - has-session argv -> $D/hassession.log (one arg per line, blank line separator)
//   - new-session argv -> $D/newsession.log (one arg per line, blank line separator)
//   - send-keys argv   -> $D/sendkeys.log  (one arg per line, blank line separator)
// capture-pane prints a ready+register pane so bootLane reaches the prompt send.
// has-session exits 1 by default so bootLane creates a fresh session; set
// FAKE_TMUX_HAS_SESSION=0 to make it exit 0 (reattach path).
const FAKE_TMUX = [
  "#!/bin/sh",
  "D=\"${FAKE_TMUX_STATE:-/tmp/armada-fake-tmux}\"",
  "mkdir -p \"$D\" 2>/dev/null",
  "case \"$1\" in",
  "  has-session)",
  "    for a in \"$@\"; do printf '%s\\n' \"$a\"; done >> \"$D/hassession.log\"",
  "    printf '\\n' >> \"$D/hassession.log\"",
  "    exit ${FAKE_TMUX_HAS_SESSION:-1} ;;",
  "  new-session)",
  "    for a in \"$@\"; do printf '%s\\n' \"$a\"; done >> \"$D/newsession.log\"",
  "    printf '\\n' >> \"$D/newsession.log\"",
  "    exit 0 ;;",
  "  capture-pane) printf 'tab agents\\nctrl+p\\nthinking\\n'; exit 0 ;;",
  "  send-keys)",
  "    for a in \"$@\"; do printf '%s\\n' \"$a\"; done >> \"$D/sendkeys.log\"",
  "    printf '\\n' >> \"$D/sendkeys.log\"",
  "    exit 0 ;;",
  "  *) exit 0 ;;",
  "esac",
].join("\n")

// Parse a blank-line-separated log of argv invocations into an array of
// arg-arrays. Trailing empty lines are ignored.
function parseArgLog(content) {
  return content
    .split("\n\n")
    .map((blk) => blk.replace(/\n$/, ""))
    .filter((blk) => blk.length > 0)
    .map((blk) => blk.split("\n"))
}

// Find the prompt sent via `send-keys -l <prompt>` across all send-keys calls.
function extractPrompt(invocations) {
  for (const args of invocations) {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "-l") return args[i + 1] ?? null
    }
  }
  return null
}

// Find the cwd arg passed to `new-session -c <cwd>`.
function extractCwd(invocations) {
  for (const args of invocations) {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "-c") return args[i + 1] ?? null
    }
  }
  return null
}

// Find the session name passed to `new-session -s <name>`.
function extractSessionName(invocations) {
  for (const args of invocations) {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "-s") return args[i + 1] ?? null
    }
  }
  return null
}

// Find the target name passed to `has-session -t <name>`.
function extractHasSessionTarget(invocations) {
  for (const args of invocations) {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "-t") return args[i + 1] ?? null
    }
  }
  return null
}

function freshState() {
  const stateDir = mkdtempSync(join(tmpdir(), "voyage-cwd-state-"))
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: FAKE_TMUX,
  })
  return { stateDir, binDir }
}

function readLogs(stateDir) {
  const ns = existsSync(join(stateDir, "newsession.log"))
    ? readFileSync(join(stateDir, "newsession.log"), "utf8")
    : ""
  const sk = existsSync(join(stateDir, "sendkeys.log"))
    ? readFileSync(join(stateDir, "sendkeys.log"), "utf8")
    : ""
  const hs = existsSync(join(stateDir, "hassession.log"))
    ? readFileSync(join(stateDir, "hassession.log"), "utf8")
    : ""
  return { newSession: parseArgLog(ns), sendKeys: parseArgLog(sk), hasSession: parseArgLog(hs) }
}

function cleanup(stateDir, binDir, laneDir) {
  try { rmSync(stateDir, { recursive: true, force: true }) } catch (_) { /* ok */ }
  try { rmSync(binDir, { recursive: true, force: true }) } catch (_) { /* ok */ }
  if (laneDir) { try { rmSync(laneDir, { recursive: true, force: true }) } catch (_) { /* ok */ } }
}

// Test 1: default prompt contains the absolute lane path, not the bare
// relative "armada/REQUIREMENTS.md" string.
test("voyage default prompt names absolute lane contract path, not relative armada/REQUIREMENTS.md", async () => {
  const { stateDir, binDir } = freshState()
  const laneDir = makeTempGitRepo()
  try {
    const r = await runCli(["voyage", "--no-open", "--no-track", laneDir], {
      env: { PATH: `${binDir}:${process.env.PATH}`, FAKE_TMUX_STATE: stateDir },
    })
    assert.strictEqual(r.code, 0, `voyage exited ${r.code}: ${r.stderr}`)

    const logs = readLogs(stateDir)
    const prompt = extractPrompt(logs.sendKeys)
    assert.ok(prompt, "a prompt must have been sent via send-keys -l")

    const expectedAbs = `${laneDir}/armada/REQUIREMENTS.md`
    assert.ok(
      prompt.includes(expectedAbs),
      `prompt should include the absolute contract path "${expectedAbs}", got: ${prompt}`,
    )
    // The old default began with "Voyage the contract in armada/REQUIREMENTS.md"
    // (relative). The fix must not regress to that bare relative form.
    assert.ok(
      !/in armada\/REQUIREMENTS\.md/.test(prompt),
      `prompt must not use the bare relative "armada/REQUIREMENTS.md" form, got: ${prompt}`,
    )
  } finally {
    cleanup(stateDir, binDir, laneDir)
  }
})

// Test 2: tmux new-session is called with -c <absLane> (cwd = lane itself)
// for a non-"." lanePath.
test("voyage new-session cwd (-c) is the absolute lane path itself, not its parent", async () => {
  const { stateDir, binDir } = freshState()
  const laneDir = makeTempGitRepo()
  try {
    const r = await runCli(["voyage", "--no-open", "--no-track", laneDir], {
      env: { PATH: `${binDir}:${process.env.PATH}`, FAKE_TMUX_STATE: stateDir },
    })
    assert.strictEqual(r.code, 0, `voyage exited ${r.code}: ${r.stderr}`)

    const logs = readLogs(stateDir)
    assert.ok(logs.newSession.length >= 1, "new-session must be invoked")
    const cwd = extractCwd(logs.newSession)
    assert.ok(cwd, "new-session must be called with -c <cwd>")
    assert.strictEqual(
      cwd, laneDir,
      `new-session -c must equal the lane itself (not its parent); got ${cwd}`,
    )
  } finally {
    cleanup(stateDir, binDir, laneDir)
  }
})

// Test 3: lanePath === "." — cwd is process.cwd() and the prompt still
// resolves to the absolute <cwd>/armada/REQUIREMENTS.md form.
test("voyage with no lane arg (lanePath '.') uses process.cwd() as cwd and absolute contract path", async () => {
  const { stateDir, binDir } = freshState()
  // Temp working dir that has its own armada/REQUIREMENTS.md (realistic lane root).
  const workDir = makeTempGitRepo()
  mkdirSync(join(workDir, "armada"), { recursive: true })
  writeFileSync(join(workDir, "armada", "REQUIREMENTS.md"), "# contract\n")
  try {
    const r = await runCli(["voyage", "--no-open", "--no-track"], {
      cwd: workDir,
      env: { PATH: `${binDir}:${process.env.PATH}`, FAKE_TMUX_STATE: stateDir },
    })
    assert.strictEqual(r.code, 0, `voyage exited ${r.code}: ${r.stderr}`)

    const logs = readLogs(stateDir)
    const cwd = extractCwd(logs.newSession)
    assert.ok(cwd, "new-session must be called with -c <cwd>")
    // On macOS /tmp is a symlink to /private/var/...; the child resolves
    // process.cwd() through the symlink, so compare real paths.
    assert.strictEqual(
      cwd, realpathSync(workDir),
      `new-session -c must equal process.cwd() for lanePath="."; got ${cwd}`,
    )

    const prompt = extractPrompt(logs.sendKeys)
    assert.ok(prompt, "a prompt must have been sent via send-keys -l")
    const expectedAbs = `${realpathSync(workDir)}/armada/REQUIREMENTS.md`
    assert.ok(
      prompt.includes(expectedAbs),
      `prompt should include the absolute contract path "${expectedAbs}", got: ${prompt}`,
    )
    assert.ok(
      !/in armada\/REQUIREMENTS\.md/.test(prompt),
      `prompt must not use the bare relative "armada/REQUIREMENTS.md" form, got: ${prompt}`,
    )
  } finally {
    cleanup(stateDir, binDir, workDir)
  }
})

// Test 4: default session name is `voyage-<basename(lanePath)>`.
test("voyage default session name is prefixed with voyage-", async () => {
  const { stateDir, binDir } = freshState()
  const laneDir = makeTempGitRepo()
  try {
    const r = await runCli(["voyage", "--no-open", "--no-track", laneDir], {
      env: { PATH: `${binDir}:${process.env.PATH}`, FAKE_TMUX_STATE: stateDir },
    })
    assert.strictEqual(r.code, 0, `voyage exited ${r.code}: ${r.stderr}`)

    const logs = readLogs(stateDir)
    assert.ok(logs.newSession.length >= 1, "new-session must be invoked")
    const name = extractSessionName(logs.newSession)
    assert.ok(name, "new-session must be called with -s <name>")
    const expected = `voyage-${basename(laneDir)}`
    assert.strictEqual(
      name, expected,
      `default session name must be "${expected}" (voyage-<basename>); got ${name}`,
    )
  } finally {
    cleanup(stateDir, binDir, laneDir)
  }
})

// Test 5: explicit --name bypasses the prefix (no double prefix).
test("voyage --name <text> overrides the voyage- prefix with no double prefix", async () => {
  const { stateDir, binDir } = freshState()
  const laneDir = makeTempGitRepo()
  try {
    const r = await runCli(["voyage", "--no-open", "--no-track", laneDir, "--name", "myname"], {
      env: { PATH: `${binDir}:${process.env.PATH}`, FAKE_TMUX_STATE: stateDir },
    })
    assert.strictEqual(r.code, 0, `voyage exited ${r.code}: ${r.stderr}`)

    const logs = readLogs(stateDir)
    assert.ok(logs.newSession.length >= 1, "new-session must be invoked")
    const name = extractSessionName(logs.newSession)
    assert.ok(name, "new-session must be called with -s <name>")
    assert.strictEqual(
      name, "myname",
      `explicit --name must be used as-is (no voyage- prefix); got ${name}`,
    )
  } finally {
    cleanup(stateDir, binDir, laneDir)
  }
})

// Test 6: reattach path uses the prefixed session name (has-session -t).
test("voyage reattach (has-session) targets the prefixed session name", async () => {
  const { stateDir, binDir } = freshState()
  const laneDir = makeTempGitRepo()
  try {
    // has-session exits 0 -> bootLane takes the reattach branch.
    const r = await runCli(["voyage", "--no-open", "--no-track", laneDir], {
      env: { PATH: `${binDir}:${process.env.PATH}`, FAKE_TMUX_STATE: stateDir, FAKE_TMUX_HAS_SESSION: "0" },
    })
    assert.strictEqual(r.code, 0, `voyage exited ${r.code}: ${r.stderr}`)

    const logs = readLogs(stateDir)
    assert.ok(logs.hasSession.length >= 1, "has-session must be invoked")
    const target = extractHasSessionTarget(logs.hasSession)
    assert.ok(target, "has-session must be called with -t <name>")
    const expected = `voyage-${basename(laneDir)}`
    assert.strictEqual(
      target, expected,
      `has-session -t must target the prefixed name "${expected}"; got ${target}`,
    )
    // new-session must NOT be invoked on the reattach path.
    assert.strictEqual(
      logs.newSession.length, 0,
      `new-session must not be invoked when reattaching; got ${logs.newSession.length} call(s)`,
    )
    assert.ok(
      /already running/.test(r.stdout),
      `stdout should report reattach; got: ${r.stdout}`,
    )
  } finally {
    cleanup(stateDir, binDir, laneDir)
  }
})
