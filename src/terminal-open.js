import { accessSync, constants } from "node:fs"
import { join } from "node:path"
import { spawn } from "node:child_process"

export function detectOS(platform) {
  if (platform === "darwin") return "macos"
  if (platform === "linux") return "linux"
  if (platform === "win32") return "windows"
  return "other"
}

export function parsePathDirs(pathEnv) {
  if (!pathEnv) return []
  return pathEnv.split(pathEnv.includes(";") ? ";" : ":")
}

export function which(bin, dirs) {
  for (const dir of dirs) {
    const full = join(dir, bin)
    try {
      accessSync(full, constants.X_OK)
      return full
    } catch {
      // not found or not executable
    }
  }
  return null
}

export function buildAttachCommand(name) {
  // Always single-quote, escaping embedded single-quotes POSIX-style
  const escaped = name.replace(/'/g, "'\\''")
  return `tmux attach -t '${escaped}'`
}

function escapeAppleScript(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

export function detectITerm(home) {
  const paths = ["/Applications/iTerm.app"]
  if (home) {
    paths.push(join(home, "Applications/iTerm.app"))
  }
  for (const p of paths) {
    try {
      accessSync(p, constants.F_OK)
      return p
    } catch {
      // not found
    }
  }
  return null
}

export function pickTerminal({ os, whichResults, hasDisplay }) {
  if (os === "macos") {
    if (whichResults.iTerm) {
      return { kind: "iTerm", argv: ["open", "-a", "iTerm"], attachCmd: "", available: true, reason: null }
    }
    // Terminal.app is always available on macOS
    return { kind: "Terminal.app", argv: ["open", "-a", "Terminal"], attachCmd: "", available: true, reason: null }
  }

  if (os === "linux") {
    if (!hasDisplay) {
      return { kind: "none", argv: [], attachCmd: "", available: false, reason: "no display (headless or SSH)" }
    }
    if (whichResults.gnomeTerminal) {
      return { kind: "gnome-terminal", argv: ["gnome-terminal", "--", "bash", "-c", "__ATTACH_CMD__; exec bash"], attachCmd: "", available: true, reason: null }
    }
    if (whichResults.konsole) {
      return { kind: "konsole", argv: ["konsole", "-e", "bash", "-c", "__ATTACH_CMD__; exec bash"], attachCmd: "", available: true, reason: null }
    }
    if (whichResults.xTerminalEmulator) {
      return { kind: "x-terminal-emulator", argv: ["x-terminal-emulator", "-e", "bash", "-c", "__ATTACH_CMD__; exec bash"], attachCmd: "", available: true, reason: null }
    }
    if (whichResults.wezterm) {
      return { kind: "wezterm", argv: ["wezterm", "start", "--", "bash", "-c", "__ATTACH_CMD__; exec bash"], attachCmd: "", available: true, reason: null }
    }
    return { kind: "none", argv: [], attachCmd: "", available: false, reason: "no X terminal emulator found" }
  }

  if (os === "windows") {
    if (whichResults.wt) {
      return { kind: "wt", argv: ["wt", "new-tab", "cmd", "/k", "__ATTACH_CMD__"], attachCmd: "", available: true, reason: null }
    }
    if (whichResults.wezterm) {
      return { kind: "wezterm", argv: ["wezterm", "start", "--", "cmd", "/k", "__ATTACH_CMD__"], attachCmd: "", available: true, reason: null }
    }
    return { kind: "none", argv: [], attachCmd: "", available: false, reason: "no Windows Terminal or wezterm" }
  }

  return { kind: "none", argv: [], attachCmd: "", available: false, reason: `unsupported platform: ${os}` }
}

function defaultExec(bin, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      ...opts,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout?.on("data", (d) => {
      stdout += d.toString()
    })
    child.stderr?.on("data", (d) => {
      stderr += d.toString()
    })
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }))
    child.on("error", (err) => reject(err))
  })
}

export async function openTerminal({
  name,
  platform,
  env,
  exec,
  log,
  dryRun,
}) {
  const os = detectOS(platform)
  const dirs = parsePathDirs(env?.PATH)
  const attachCmd = buildAttachCommand(name)
  const run = exec || defaultExec

  // Build whichResults: check PATH binaries + iTerm.app on macOS
  const whichResults = {}
  if (os === "macos") {
    const itermPath = detectITerm(env?.HOME)
    if (itermPath) {
      whichResults.iTerm = itermPath
    }
  }
  for (const bin of ["wezterm", "gnome-terminal", "konsole", "x-terminal-emulator", "wt"]) {
    const found = which(bin, dirs)
    if (found) {
      const key =
        bin === "gnome-terminal" ? "gnomeTerminal"
        : bin === "x-terminal-emulator" ? "xTerminalEmulator"
        : bin
      whichResults[key] = found
    }
  }

  const hasDisplay = os === "macos" ? true : Boolean(env?.DISPLAY || env?.WAYLAND_DISPLAY)

  const choice = pickTerminal({ os, whichResults, hasDisplay })

  if (!choice.available) {
    log?.(`[terminal] no terminal available: ${choice.reason}`)
    return { opened: false, kind: "none", hint: attachCmd }
  }

  if (dryRun) {
    return { opened: true, kind: choice.kind, hint: null }
  }

  // macOS: use AppleScript to open the terminal and run attach command
  if (os === "macos") {
    const appName = choice.kind === "iTerm" ? "iTerm" : "Terminal"
    const appleScript = `tell application "${appName}" to do script "${escapeAppleScript(attachCmd)}"`
    try {
      await run("osascript", ["-e", appleScript], { env })
      return { opened: true, kind: choice.kind, hint: null }
    } catch (err) {
      log?.(`[terminal] launch failed: ${err?.message ?? err}`)
      return { opened: false, kind: choice.kind, hint: attachCmd }
    }
  }

  // Linux / Windows: substitute attachCmd into argv template
  const argv = choice.argv.map((a) => a.replace(/__ATTACH_CMD__/g, attachCmd))
  try {
    await run(argv[0], argv.slice(1), { env })
    return { opened: true, kind: choice.kind, hint: null }
  } catch (err) {
    log?.(`[terminal] launch failed: ${err?.message ?? err}`)
    return { opened: false, kind: choice.kind, hint: attachCmd }
  }
}
