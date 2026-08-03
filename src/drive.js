import { spawn } from "node:child_process"
import { basename } from "node:path"
import { defaultRunEntry, writeRun, updateRun } from "./fleet-tracker.js"

export class DriveError extends Error {
  constructor(message, paneTail) {
    super(message)
    this.name = "DriveError"
    this.paneTail = paneTail
  }
}

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

async function defaultGitBranch(cwd) {
  try {
    const { stdout, code } = await defaultExec("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd })
    if (code === 0 && stdout.trim()) return stdout.trim()
  } catch {
    // git missing
  }
  return ""
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function defaultLog(msg) {
  console.log(msg)
}

export async function bootLane({
  name,
  cwd,
  command,
  prompt,
  readyPattern = /tab agents|ctrl\+p/i,
  registerPattern = /thinking/i,
  timeoutMs = 30000,
  pollMs = 250,
  registerTimeoutMs = 3000,
  tmuxBin = "tmux",
  exec: givenExec,
  log = defaultLog,
  track = true,
  lane = null,
  branch = null,
  contractPath = null,
  cost = 0,
  gitBranch = defaultGitBranch,
}) {
  const run = givenExec || defaultExec
  const laneName = lane ?? basename(cwd)
  const branchName = branch ?? (await gitBranch(cwd))
  const contract = contractPath ?? "armada/REQUIREMENTS.md"

  const has = await run(tmuxBin, ["has-session", "-t", name])
  if (has.code === 0) {
    log(`[drive] session ${name} exists, reattaching`)

    // Refresh heartbeat on reattach
    if (track) {
      try {
        const { capturePaneTail } = await import("./heartbeat.js")
        const paneTail = await capturePaneTail({ tmuxBin, session: name, exec: run })
        await updateRun(name, {
          lastHeartbeatAt: new Date().toISOString(),
          tmuxPaneTail: paneTail,
        })
      } catch (err) {
        log(`[drive] tracker warning: updateRun failed for reattach — ${err.message}`)
      }
    }

    return { name, attached: true }
  }

  log(`[drive] creating session ${name}`)
  const create = await run(tmuxBin, [
    "new-session",
    "-d",
    "-s",
    name,
    "-c",
    cwd,
    command,
  ])
  if (create.code !== 0) {
    throw new DriveError(`tmux new-session failed: ${create.stderr}`, "")
  }

  // Write run entry on first boot
  if (track) {
    try {
      const entry = defaultRunEntry({
        session: name,
        cwd: laneName,
        branch: branchName,
        contractPath: contract,
      })
      entry.cost = cost
      await writeRun(entry)
    } catch (err) {
      log(`[drive] tracker warning: writeRun failed — ${err.message}`)
    }
  }

  const deadline = Date.now() + timeoutMs
  let paneOutput = ""
  while (Date.now() < deadline) {
    const { stdout } = await run(tmuxBin, [
      "capture-pane",
      "-t",
      name,
      "-p",
    ])
    paneOutput = stdout
    if (readyPattern.test(paneOutput)) break
    await sleep(pollMs)
  }

  if (!readyPattern.test(paneOutput)) {
    const tail = paneOutput.slice(-2000)
    throw new DriveError(
      `TUI not ready after ${timeoutMs}ms. Last pane output:\n${tail}`,
      tail,
    )
  }

  const sendPrompt = async () => {
    await run(tmuxBin, ["send-keys", "-t", name, "-l", prompt])
    await run(tmuxBin, ["send-keys", "-t", name, "Enter"])
  }

  await sendPrompt()
  log(`[drive] prompt sent to ${name}`)

  const checkRegister = async () => {
    const regDeadline = Date.now() + registerTimeoutMs
    while (Date.now() < regDeadline) {
      await sleep(pollMs)
      const { stdout } = await run(tmuxBin, [
        "capture-pane",
        "-t",
        name,
        "-p",
      ])
      if (registerPattern.test(stdout)) return true
    }
    return false
  }

  let registered = await checkRegister()

  if (!registered) {
    log(`[drive] register pattern not detected, resending prompt`)
    await sendPrompt()
    registered = await checkRegister()
    if (!registered) {
      const { stdout } = await run(tmuxBin, [
        "capture-pane",
        "-t",
        name,
        "-p",
      ])
      const tail = stdout.slice(-2000)
      throw new DriveError(
        `prompt did not register within ${registerTimeoutMs * 2}ms (after resend). Last pane output:\n${tail}`,
        tail,
      )
    }
  }

  return { name, attached: false }
}
