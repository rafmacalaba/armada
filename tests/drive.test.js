import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import { execFile } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeBin } from "./helpers.js"
import { bootLane, DriveError } from "../src/drive.js"

const FAKE_TMUX = `#!/bin/sh
D="\${FAKE_TMUX_STATE:-/tmp/tmux-fake}"
mkdir -p "$D" 2>/dev/null

parse_session() {
  p=""
  for a in "$@"; do
    [ "$p" = "-t" ] && { printf '%s' "$a"; return; }
    [ "$p" = "-s" ] && { printf '%s' "$a"; return; }
    p="$a"
  done
  printf '%s' "none"
}

case "$1" in
  has-session)
    S=$(parse_session "$@")
    [ -f "$D/$S.exists" ] && exit 0 || exit 1
    ;;
  new-session)
    S=$(parse_session "$@")
    touch "$D/$S.exists"
    echo "0" > "$D/$S.polls"
    echo "0" > "$D/$S.prompts"
    exit 0
    ;;
  capture-pane)
    S=$(parse_session "$@")
    c=0
    [ -f "$D/$S.polls" ] && c=$(cat "$D/$S.polls")
    c=$((c + 1))
    echo "$c" > "$D/$S.polls"

    pc=0
    [ -f "$D/$S.prompts" ] && pc=$(cat "$D/$S.prompts")

    case "$S" in
      timeout-test)
        printf "Loading...\\n" ; exit 0 ;;
      never-ready)
        printf "Still not ready...\\n" ; exit 0 ;;
      never-register)
        if [ "$c" -ge 2 ]; then
          printf "tab agents\\nctrl+p\\n"
        else
          printf "Loading...\\n"
        fi
        exit 0 ;;
      resend-only)
        if [ "$c" -ge 2 ]; then
          printf "tab agents\\nctrl+p\\n"
          if [ "$pc" -ge 2 ] && [ "$c" -ge 8 ]; then
            printf "thinking...\\n"
          fi
        else
          printf "Loading...\\n"
        fi
        exit 0 ;;
      *)
        if [ "$c" -ge 2 ]; then
          printf "tab agents\\nctrl+p\\n"
          if [ "$pc" -ge 1 ] && [ "$c" -ge 5 ]; then
            printf "thinking...\\n"
          fi
        else
          printf "Loading...\\n"
        fi
        exit 0 ;;
    esac
    ;;
  send-keys)
    S=$(parse_session "$@")
    for a in "$@"; do printf '%s\\n' "$a"; done >> "$D/$S.sendlog"
    for a in "$@"; do
      if [ "$a" = "-l" ]; then
        pc=0
        [ -f "$D/$S.prompts" ] && pc=$(cat "$D/$S.prompts")
        pc=$((pc + 1))
        echo "$pc" > "$D/$S.prompts"
        break
      fi
    done
    exit 0
    ;;
esac
`

function makeExec(stateDir) {
  return (bin, args) =>
    new Promise((resolve) => {
      execFile(
        bin,
        args,
        {
          env: { ...process.env, FAKE_TMUX_STATE: stateDir },
          timeout: 15000,
        },
        (err, stdout, stderr) =>
          resolve({ stdout: stdout ?? "", stderr: stderr ?? "", code: err?.code ?? 0 }),
      )
    })
}

describe("bootLane", () => {
  let stateDir
  let binDir
  let tmuxBin
  let execFn

  before(() => {
    stateDir = mkdtempSync(join(tmpdir(), "drive-test-"))
    binDir = makeBin({ tmux: FAKE_TMUX })
    tmuxBin = join(binDir, "tmux")
    execFn = makeExec(stateDir)
  })

  after(() => {
    try { rmSync(stateDir, { recursive: true, force: true }) } catch (_) { /* ok */ }
    try { rmSync(binDir, { recursive: true, force: true }) } catch (_) { /* ok */ }
  })

  it("happy path: boots, polls until ready, sends prompt, detects register", async () => {
    const logs = []
    const result = await bootLane({
      name: "happy-test",
      cwd: "/tmp",
      command: "opencode",
      prompt: "Drive the contract",
      timeoutMs: 5000,
      pollMs: 10,
      registerTimeoutMs: 200,
      tmuxBin,
      exec: execFn,
      log: (msg) => logs.push(msg),
      track: false,
    })
    assert.deepStrictEqual(result, { name: "happy-test", attached: false })
    assert.ok(logs.some((m) => m.includes("creating session")))
    assert.ok(logs.some((m) => m.includes("prompt sent")))
  })

  it("idempotent: re-run attaches, does not create again", async () => {
    // First run: creates the session
    await bootLane({
      name: "idem-test",
      cwd: "/tmp",
      command: "opencode",
      prompt: "Drive",
      timeoutMs: 5000,
      pollMs: 10,
      registerTimeoutMs: 200,
      tmuxBin,
      exec: execFn,
      track: false,
    })

    // Second run: should attach, not re-create
    const logs = []
    const result = await bootLane({
      name: "idem-test",
      cwd: "/tmp",
      command: "opencode",
      prompt: "Drive",
      timeoutMs: 5000,
      pollMs: 10,
      registerTimeoutMs: 200,
      tmuxBin,
      exec: execFn,
      log: (msg) => logs.push(msg),
      track: false,
    })
    assert.deepStrictEqual(result, { name: "idem-test", attached: true })
    assert.ok(logs.some((m) => m.includes("reattaching")))
    assert.ok(!logs.some((m) => m.includes("creating")))
  })

  it("timeout: throws DriveError with pane tail when never ready", async () => {
    await assert.rejects(
      () =>
        bootLane({
          name: "timeout-test",
          cwd: "/tmp",
          command: "opencode",
          prompt: "Drive",
          timeoutMs: 200,
          pollMs: 10,
          registerTimeoutMs: 50,
          tmuxBin,
          exec: execFn,
          track: false,
        }),
      {
        name: "DriveError",
        message: /TUI not ready/,
        paneTail: /Loading/,
      },
    )
  })

  it("send/resend: resends prompt when register not detected on first poll", async () => {
    const logs = []
    await bootLane({
      name: "resend-only",
      cwd: "/tmp",
      command: "opencode",
      prompt: "Drive",
      timeoutMs: 5000,
      pollMs: 10,
      registerTimeoutMs: 100,
      tmuxBin,
      exec: execFn,
      log: (msg) => logs.push(msg),
      track: false,
    })
    // Should see the resend log message
    assert.ok(logs.some((m) => m.includes("resending prompt")))
  })

  it("shell injection: prompt with special chars is passed literally via -l", async () => {
    const dangerousPrompt = '"; rm -rf /'
    await bootLane({
      name: "inject-test",
      cwd: "/tmp",
      command: "opencode",
      prompt: dangerousPrompt,
      timeoutMs: 5000,
      pollMs: 10,
      registerTimeoutMs: 200,
      tmuxBin,
      exec: execFn,
      track: false,
    })

    // Read the sendlog and verify the prompt was passed literally as a single arg
    const sendLog = readFileSync(join(stateDir, "inject-test.sendlog"), "utf8")
    const lines = sendLog.trim().split("\n")

    // Find the -l arg line
    let sawL = false
    let promptArg = null
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === "-l") {
        sawL = true
        promptArg = lines[i + 1]
        break
      }
    }
    assert.ok(sawL, "send-keys should use -l for literal")
    assert.strictEqual(promptArg, dangerousPrompt, "prompt must be passed literally, unmodified")
  })

  // DEF-013: throws DriveError when register never detected after resend
  it("register-never: throws DriveError after prompt resend fails", async () => {
    await assert.rejects(
      () =>
        bootLane({
          name: "never-register",
          cwd: "/tmp",
          command: "opencode",
          prompt: "Drive",
          timeoutMs: 5000,
          pollMs: 10,
          registerTimeoutMs: 100,
          tmuxBin,
          exec: execFn,
          track: false,
        }),
      {
        name: "DriveError",
        message: /did not register/,
      },
    )
  })
})

describe("bootLane tracker integration", () => {
  let stateDir
  let binDir
  let tmuxBin
  let execFn
  let storeDir

  before(() => {
    stateDir = mkdtempSync(join(tmpdir(), "drive-track-"))
    binDir = makeBin({ tmux: FAKE_TMUX })
    tmuxBin = join(binDir, "tmux")
    execFn = makeExec(stateDir)
    storeDir = mkdtempSync(join(tmpdir(), "drv-runs-"))
    process.env.ARMADA_RUNS_DIR = storeDir
  })

  after(() => {
    delete process.env.ARMADA_RUNS_DIR
    try { rmSync(stateDir, { recursive: true, force: true }) } catch { /* ok */ }
    try { rmSync(binDir, { recursive: true, force: true }) } catch { /* ok */ }
    try { rmSync(storeDir, { recursive: true, force: true }) } catch { /* ok */ }
  })

  it("writes a run entry on first boot", async () => {
    const result = await bootLane({
      name: "tracker-test",
      cwd: "/tmp/some-lane",
      command: "opencode",
      prompt: "Drive the contract",
      timeoutMs: 5000,
      pollMs: 10,
      registerTimeoutMs: 200,
      tmuxBin,
      exec: execFn,
      track: true,
      branch: "feat/fleet-dashboard",
      gitBranch: async () => "feat/fleet-dashboard",
    })
    assert.strictEqual(result.attached, false)

    // Check run file exists
    const runPath = join(storeDir, "tracker-test.json")
    let raw
    try {
      raw = readFileSync(runPath, "utf8")
    } catch {
      assert.fail("run file should exist at " + runPath)
    }
    const entry = JSON.parse(raw)
    assert.strictEqual(entry.session, "tracker-test")
    assert.strictEqual(entry.status, "ACTIVE")
    assert.strictEqual(entry.lane, "some-lane")
    assert.strictEqual(entry.branch, "feat/fleet-dashboard")
    assert.strictEqual(entry.contract, "armada/REQUIREMENTS.md")
  })

  it("updates lastHeartbeatAt on reattach", async () => {
    // First boot writes the entry
    await bootLane({
      name: "reattach-track",
      cwd: "/tmp/reattach-lane",
      command: "opencode",
      prompt: "Drive the contract",
      timeoutMs: 5000,
      pollMs: 10,
      registerTimeoutMs: 200,
      tmuxBin,
      exec: execFn,
      track: true,
      branch: "feat/fleet-dashboard",
      gitBranch: async () => "feat/fleet-dashboard",
    })

    // Read the initial entry
    const runPath = join(storeDir, "reattach-track.json")
    const initial = JSON.parse(readFileSync(runPath, "utf8"))
    const initialHb = initial.lastHeartbeatAt

    // Wait a tiny bit so timestamp changes
    await new Promise((r) => setTimeout(r, 50))

    // Reattach
    const result = await bootLane({
      name: "reattach-track",
      cwd: "/tmp/reattach-lane",
      command: "opencode",
      prompt: "Drive the contract",
      timeoutMs: 5000,
      pollMs: 10,
      tmuxBin,
      exec: execFn,
      track: true,
      branch: "feat/fleet-dashboard",
      gitBranch: async () => "feat/fleet-dashboard",
    })
    assert.strictEqual(result.attached, true)

    // Check lastHeartbeatAt advanced
    const updated = JSON.parse(readFileSync(runPath, "utf8"))
    assert.ok(
      new Date(updated.lastHeartbeatAt).getTime() >= new Date(initialHb).getTime(),
      "lastHeartbeatAt should not go backwards on reattach",
    )
  })

  it("does not write run entry when track is false", async () => {
    await bootLane({
      name: "no-track-test",
      cwd: "/tmp/no-track-lane",
      command: "opencode",
      prompt: "Drive the contract",
      timeoutMs: 5000,
      pollMs: 10,
      registerTimeoutMs: 200,
      tmuxBin,
      exec: execFn,
      track: false,
      branch: "feat/fleet-dashboard",
      gitBranch: async () => "feat/fleet-dashboard",
    })

    const runPath = join(storeDir, "no-track-test.json")
    try {
      readFileSync(runPath, "utf8")
      assert.fail("run file should NOT exist when track=false")
    } catch (err) {
      assert.strictEqual(err.code, "ENOENT", "file should be absent")
    }
  })
})
