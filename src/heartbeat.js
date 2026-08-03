/**
 * Heartbeat poller — keeps the run entry fresh so the dashboard can show ACTIVE vs STALLED.
 *
 * @module heartbeat
 */

import { spawn } from "node:child_process"
import { getStoreDir, readRun, writeRun } from "./fleet-tracker.js"

// ---- helpers --------------------------------------------------------------

function defaultExec(bin, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      ...opts,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d) => {
      stdout += d.toString()
    })
    child.stderr.on("data", (d) => {
      stderr += d.toString()
    })
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }))
    child.on("error", (err) => reject(err))
  })
}

// ---- API ------------------------------------------------------------------

/**
 * Capture the last N lines from a tmux session pane.
 * @param {{ tmuxBin?: string, session: string, lines?: number, exec?: function }} opts
 * @returns {Promise<string>}
 */
export async function capturePaneTail({
  tmuxBin = "tmux",
  session,
  lines = 40,
  exec = defaultExec,
}) {
  try {
    const { stdout, code } = await exec(tmuxBin, [
      "capture-pane",
      "-t",
      session,
      "-p",
    ])
    if (code !== 0) return ""
    // Split, then trim trailing empty strings (real tmux adds a trailing newline)
    const allLines = stdout.split("\n")
    while (allLines.length > 0 && allLines[allLines.length - 1] === "") {
      allLines.pop()
    }
    const tail = allLines.slice(-lines)
    return tail.join("\n")
  } catch {
    return ""
  }
}

/**
 * Refresh the heartbeat on a single run entry.
 * If the tmux session is gone, mark STALLED.
 * If the run entry is missing, no-op and return null.
 *
 * @param {{ session: string, tmuxBin?: string, exec?: function, now?: function, storeDir?: string }} opts
 * @returns {Promise<object|null>}
 */
export async function tickHeartbeat({
  session,
  tmuxBin = "tmux",
  exec = defaultExec,
  now = () => Date.now(),
  storeDir = getStoreDir(),
}) {
  const entry = await readRun(session, { storeDir })
  if (!entry) return null

  // Check if tmux session still exists
  let sessionGone = false
  try {
    const { code } = await exec(tmuxBin, ["has-session", "-t", session])
    sessionGone = code !== 0
  } catch {
    sessionGone = true
  }

  const paneTail = sessionGone ? "" : await capturePaneTail({ tmuxBin, session, exec })

  const patch = {
    lastHeartbeatAt: new Date(now()).toISOString(),
    tmuxPaneTail: paneTail,
    status: sessionGone ? "STALLED" : "ACTIVE",
  }

  const merged = { ...entry, ...patch }
  await writeRun(merged, { storeDir })
  return merged
}

/**
 * Start a heartbeat interval for a single session.
 * Runs the first tick immediately, then repeats on intervalMs.
 *
 * @param {{ session: string, intervalMs?: number, tmuxBin?: string, exec?: function, now?: function, storeDir?: string }} opts
 * @returns {{ stop: function }}
 */
export async function startHeartbeat({
  session,
  intervalMs = 30_000,
  ...rest
}) {
  let id = null
  let stopped = false

  // Run first tick immediately, await it
  try {
    await tickHeartbeat({ session, ...rest })
  } catch {
    // best-effort
  }

  id = setInterval(() => {
    if (stopped) return
    tickHeartbeat({ session, ...rest }).catch(() => {
      // best-effort
    })
  }, intervalMs)

  return {
    stop() {
      stopped = true
      if (id !== null) {
        clearInterval(id)
        id = null
      }
    },
  }
}

/**
 * Start heartbeat intervals for every active run in the store.
 *
 * @param {{ intervalMs?: number, tmuxBin?: string, exec?: function, now?: function, storeDir?: string }} opts
 * @returns {Promise<Map<string, { stop: function }>>}
 */
export async function startHeartbeatForActive({
  intervalMs = 30_000,
  ...rest
}) {
  const { listRuns } = await import("./fleet-tracker.js")
  const storeDir = rest.storeDir || getStoreDir()
  const runs = await listRuns({ storeDir })

  const handles = new Map()
  for (const run of runs) {
    if (run.status === "STALLED") continue
    const h = await startHeartbeat({ session: run.session, intervalMs, storeDir, ...rest })
    handles.set(run.session, h)
  }
  return handles
}
