import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import { execFile } from "node:child_process"
import { mkdtempSync, rmSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeBin } from "./helpers.js"
import {
  capturePaneTail,
  tickHeartbeat,
  startHeartbeat,
  startHeartbeatForActive,
} from "../src/heartbeat.js"
import { getStoreDir, writeRun, readRun, defaultRunEntry } from "../src/fleet-tracker.js"

// ---- fake tmux ------------------------------------------------------------

const FAKE_TMUX = `#!/bin/sh
D="\${FAKE_TMUX_STATE:-/tmp/tmux-fake}"

parse_session() {
  p=""
  for a in "$@"; do
    [ "$p" = "-t" ] && { printf '%s' "$a"; return; }
    p="$a"
  done
  printf '%s' "none"
}

case "$1" in
  has-session)
    S=$(parse_session "$@")
    [ -f "$D/$S.exists" ] && exit 0 || exit 1
    ;;
  capture-pane)
    S=$(parse_session "$@")
    if [ -f "$D/$S.pane" ]; then
      cat "$D/$S.pane"
    else
      echo "line1"
      echo "line2"
      echo "line3"
      echo "line4"
      echo "line5"
      echo "line6"
    fi
    exit 0
    ;;
  *)
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

// ---- tests ----------------------------------------------------------------

describe("capturePaneTail", () => {
  let stateDir
  let binDir
  let tmuxBin
  let execFn

  before(() => {
    stateDir = mkdtempSync(join(tmpdir(), "hb-cpt-"))
    binDir = makeBin({ tmux: FAKE_TMUX })
    tmuxBin = join(binDir, "tmux")
    execFn = makeExec(stateDir)
  })

  after(() => {
    try { rmSync(stateDir, { recursive: true, force: true }) } catch { /* ok */ }
    try { rmSync(binDir, { recursive: true, force: true }) } catch { /* ok */ }
  })

  it("returns the last N lines of pane output", async () => {
    const result = await capturePaneTail({
      tmuxBin,
      session: "any-session",
      lines: 3,
      exec: execFn,
    })
    const lines = result.split("\n")
    assert.ok(lines.length <= 3, "should return at most 3 lines")
    assert.ok(result.includes("line4"), "should include line4")
    assert.ok(result.includes("line6"), "should include line6")
  })

  it("returns empty string on missing session", async () => {
    // A session that does not exist will still work for capture-pane
    // but we test the exec throwing — use a bin that will throw
    const badExec = () => Promise.reject(new Error("gone"))
    const result = await capturePaneTail({
      tmuxBin: "/nonexistent/tmux",
      session: "gone",
      exec: badExec,
    })
    assert.strictEqual(result, "")
  })
})

describe("tickHeartbeat", () => {
  let stateDir
  let binDir
  let tmuxBin
  let execFn
  let storeDir

  before(() => {
    stateDir = mkdtempSync(join(tmpdir(), "hb-tick-"))
    binDir = makeBin({ tmux: FAKE_TMUX })
    tmuxBin = join(binDir, "tmux")
    execFn = makeExec(stateDir)
    storeDir = mkdtempSync(join(tmpdir(), "hb-runs-"))
    process.env.ARMADA_RUNS_DIR = storeDir
  })

  after(() => {
    delete process.env.ARMADA_RUNS_DIR
    try { rmSync(stateDir, { recursive: true, force: true }) } catch { /* ok */ }
    try { rmSync(binDir, { recursive: true, force: true }) } catch { /* ok */ }
    try { rmSync(storeDir, { recursive: true, force: true }) } catch { /* ok */ }
  })

  it("updates lastHeartbeatAt and tmuxPaneTail on a present session", async () => {
    // Mark the session as existing in fake tmux
    const { writeFileSync } = await import("node:fs")
    writeFileSync(join(stateDir, "hb-session.exists"), "")

    const entry = defaultRunEntry({
      session: "hb-session",
      cwd: "/tmp/hb-test",
      branch: "main",
      contractPath: "REQUIREMENTS.md",
    })
    await writeRun(entry, { storeDir })

    const before = Date.now()
    const result = await tickHeartbeat({
      session: "hb-session",
      tmuxBin,
      exec: execFn,
      storeDir,
    })

    assert.ok(result, "should return the updated entry")
    const lastHb = new Date(result.lastHeartbeatAt).getTime()
    assert.ok(lastHb >= before, "lastHeartbeatAt should be >= before timestamp")
    assert.ok(lastHb <= Date.now() + 1000, "lastHeartbeatAt should be recent")
    assert.ok(result.tmuxPaneTail.length > 0, "tmuxPaneTail should be populated")
    assert.strictEqual(result.status, "ACTIVE")
  })

  it("sets status to STALLED when session is gone", async () => {
    const entry = defaultRunEntry({
      session: "stalled-session",
      cwd: "/tmp/stalled-test",
      branch: "main",
      contractPath: "REQUIREMENTS.md",
    })
    await writeRun(entry, { storeDir })

    // Session does not have an .exists file → has-session exits 1
    const result = await tickHeartbeat({
      session: "stalled-session",
      tmuxBin,
      exec: execFn,
      storeDir,
    })

    assert.ok(result, "should return the updated entry")
    assert.strictEqual(result.status, "STALLED")
    assert.strictEqual(result.tmuxPaneTail, "")
  })

  it("returns null when run entry does not exist", async () => {
    const result = await tickHeartbeat({
      session: "nonexistent",
      tmuxBin,
      exec: execFn,
      storeDir,
    })
    assert.strictEqual(result, null)
  })
})

describe("startHeartbeat", () => {
  let stateDir
  let binDir
  let tmuxBin
  let execFn
  let storeDir

  before(() => {
    stateDir = mkdtempSync(join(tmpdir(), "hb-start-"))
    binDir = makeBin({ tmux: FAKE_TMUX })
    tmuxBin = join(binDir, "tmux")
    execFn = makeExec(stateDir)
    storeDir = mkdtempSync(join(tmpdir(), "hb-runs2-"))
    process.env.ARMADA_RUNS_DIR = storeDir
  })

  after(() => {
    delete process.env.ARMADA_RUNS_DIR
    try { rmSync(stateDir, { recursive: true, force: true }) } catch { /* ok */ }
    try { rmSync(binDir, { recursive: true, force: true }) } catch { /* ok */ }
    try { rmSync(storeDir, { recursive: true, force: true }) } catch { /* ok */ }
  })

  it("ticks at least once and stop() halts further ticks", async () => {
    const { writeFileSync } = await import("node:fs")
    writeFileSync(join(stateDir, "hb-interval.exists"), "")

    const entry = defaultRunEntry({
      session: "hb-interval",
      cwd: "/tmp/hb-interval",
      branch: "main",
      contractPath: "REQUIREMENTS.md",
    })
    // Set an old lastHeartbeatAt so we can detect the tick
    entry.lastHeartbeatAt = new Date(Date.now() - 3600000).toISOString()
    await writeRun(entry, { storeDir })

    const oldEntry = await readRun("hb-interval", { storeDir })
    const oldHb = oldEntry.lastHeartbeatAt

    const hb = await startHeartbeat({
      session: "hb-interval",
      intervalMs: 25,
      tmuxBin,
      exec: execFn,
      storeDir,
    })

    // Wait for at least 2 intervals (first is immediate, then one more)
    await new Promise((r) => setTimeout(r, 80))

    hb.stop()

    // Wait a bit more to ensure no more ticks
    await new Promise((r) => setTimeout(r, 80))

    const updated = await readRun("hb-interval", { storeDir })
    assert.ok(updated, "entry should still exist")
    const newHb = updated.lastHeartbeatAt
    assert.notStrictEqual(newHb, oldHb, "heartbeat should have been updated")
    assert.strictEqual(updated.status, "ACTIVE")

    // Capture the value after stop
    const afterStop = updated.lastHeartbeatAt

    // Wait more and verify it doesn't change further
    await new Promise((r) => setTimeout(r, 80))
    const finalEntry = await readRun("hb-interval", { storeDir })
    assert.strictEqual(finalEntry.lastHeartbeatAt, afterStop, "heartbeat should not tick after stop")
  })
})

describe("startHeartbeatForActive", () => {
  let stateDir
  let binDir
  let tmuxBin
  let execFn
  let storeDir

  before(() => {
    stateDir = mkdtempSync(join(tmpdir(), "hb-active-"))
    binDir = makeBin({ tmux: FAKE_TMUX })
    tmuxBin = join(binDir, "tmux")
    execFn = makeExec(stateDir)
    storeDir = mkdtempSync(join(tmpdir(), "hb-runs3-"))
    process.env.ARMADA_RUNS_DIR = storeDir
  })

  after(() => {
    delete process.env.ARMADA_RUNS_DIR
    try { rmSync(stateDir, { recursive: true, force: true }) } catch { /* ok */ }
    try { rmSync(binDir, { recursive: true, force: true }) } catch { /* ok */ }
    try { rmSync(storeDir, { recursive: true, force: true }) } catch { /* ok */ }
  })

  it("starts heartbeats for all active entries, skips STALLED", async () => {
    const { writeFileSync } = await import("node:fs")

    // Active session
    writeFileSync(join(stateDir, "active-1.exists"), "")
    const e1 = defaultRunEntry({
      session: "active-1",
      cwd: "/tmp/active-1",
      branch: "main",
      contractPath: "REQUIREMENTS.md",
    })
    await writeRun(e1, { storeDir })

    // Stalled entry (should be skipped)
    const e2 = defaultRunEntry({
      session: "stalled-1",
      cwd: "/tmp/stalled-1",
      branch: "main",
      contractPath: "REQUIREMENTS.md",
    })
    e2.status = "STALLED"
    await writeRun(e2, { storeDir })

    const handles = await startHeartbeatForActive({
      intervalMs: 50,
      tmuxBin,
      exec: execFn,
      storeDir,
    })

    // Should have started heartbeat for active-1 only
    assert.strictEqual(handles.size, 1, "should start heartbeat for active-1 only")
    assert.ok(handles.has("active-1"), "handles should contain active-1")
    assert.ok(!handles.has("stalled-1"), "handles should NOT contain stalled-1")

    // Wait for a tick
    await new Promise((r) => setTimeout(r, 100))

    // Stop all
    for (const [, h] of handles) h.stop()

    const updated = await readRun("active-1", { storeDir })
    assert.ok(updated, "active-1 should still exist")
    assert.strictEqual(updated.status, "ACTIVE")
  })
})
