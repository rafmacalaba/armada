import { accessSync, constants } from "node:fs"
import { join } from "node:path"
import { spawn, spawnSync } from "node:child_process"

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

function _classicPickTerminal({ os, whichResults, hasDisplay }) {
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
    // gnome-terminal --tab detection deferred: user is in gnome-terminal iff
    // ps shows parent = gnome-terminal-server, requires platform-specific check.
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
    if (whichResults.wezterm) {
      return { kind: "wezterm", argv: ["wezterm", "start", "--", "cmd", "/k", "__ATTACH_CMD__"], attachCmd: "", available: true, reason: null }
    }
    if (whichResults.wt) {
      return { kind: "wt", argv: ["wt", "new-tab", "cmd", "/k", "__ATTACH_CMD__"], attachCmd: "", available: true, reason: null }
    }
    return { kind: "none", argv: [], attachCmd: "", available: false, reason: "no wezterm or Windows Terminal" }
  }

  return { kind: "none", argv: [], attachCmd: "", available: false, reason: `unsupported platform: ${os}` }
}

export function pickAttachStrategy({ env, os, whichResults, hasDisplay, hasWeztermServer }) {
  const TERM_PROGRAM = env?.TERM_PROGRAM

  // Rule 1: macOS + Apple_Terminal
  if (os === "macos" && TERM_PROGRAM === "Apple_Terminal") {
    return { mode: "tab", kind: "Terminal.app", template: { kind: "macos-tab", app: "Terminal" }, available: true, reason: null, hint: null }
  }

  // Rule 2: macOS + iTerm.app
  if (os === "macos" && TERM_PROGRAM === "iTerm.app") {
    return { mode: "tab", kind: "iTerm", template: { kind: "macos-tab", app: "iTerm" }, available: true, reason: null, hint: null }
  }

  // Rule 3: WezTerm (any os)
  if (TERM_PROGRAM === "WezTerm") {
    return { mode: "tab", kind: "wezterm", template: { kind: "argv-subst", argv: ["wezterm", "start", "--", "bash", "-c", "__ATTACH_CMD__; exec bash"] }, available: true, reason: null, hint: null }
  }

  // Rule 4: vscode / cursor (takes precedence over rule 5)
  const isVSCode = TERM_PROGRAM === "vscode" || TERM_PROGRAM === "cursor"
  const vscodeIpc = env?.VSCODE_IPC_HOOK_CLI
  if (isVSCode || vscodeIpc) {
    const term = TERM_PROGRAM || "vscode"
    return { mode: "hint", kind: "none", template: null, available: false, reason: `${term} integrated terminal cannot be addressed from outside`, hint: null }
  }

  // Rule 5: wezterm server running (macOS or Linux)
  if (hasWeztermServer && (os === "macos" || os === "linux")) {
    return { mode: "tab", kind: "wezterm", template: { kind: "argv-subst", argv: ["wezterm", "start", "--", "bash", "-c", "__ATTACH_CMD__; exec bash"] }, available: true, reason: null, hint: null }
  }

  // Rule 5b: KONSOLE_VERSION → konsole tab (inside existing konsole window)
  if (env?.KONSOLE_VERSION) {
    return { mode: "tab", kind: "konsole", template: { kind: "argv-subst", argv: ["konsole", "--new-tab", "-e", "bash", "-c", "__ATTACH_CMD__; exec bash"] }, available: true, reason: null, hint: null }
  }

  // Rule 6: delegate to classic pickTerminal
  const classic = _classicPickTerminal({ os, whichResults, hasDisplay })

  // macOS: open -a Terminal/iTerm has no __ATTACH_CMD__; wrap as macos-window (osascript do script)
  if (os === "macos" && classic.available && classic.argv[0] === "open" && classic.argv[1] === "-a") {
    const app = classic.argv[2]
    return { mode: "window", kind: classic.kind, template: { kind: "macos-window", app }, available: true, reason: null, hint: null }
  }

  return { mode: "window", kind: classic.kind, template: { kind: "argv-subst", argv: classic.argv }, available: classic.available, reason: classic.reason, hint: null }
}

export function pickTerminal({ os, whichResults, hasDisplay }) {
  const s = pickAttachStrategy({ env: {}, os, whichResults, hasDisplay, hasWeztermServer: false })
  // For backwards compat, strip the new fields and return the original shape
  if (s.template?.kind === "macos-window") {
    return { kind: s.kind, argv: ["open", "-a", s.template.app], attachCmd: "", available: s.available, reason: s.reason }
  }
  return { kind: s.kind, argv: s.template?.argv ?? [], attachCmd: "", available: s.available, reason: s.reason }
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
  const hasWeztermServer = Boolean(whichResults.wezterm)

  const strategy = pickAttachStrategy({ env, os, whichResults, hasDisplay, hasWeztermServer })

  if (!strategy.available) {
    log?.(`[terminal] no terminal available: ${strategy.reason}`)
    return { opened: false, kind: "none", mode: "hint", hint: attachCmd, reason: strategy.reason }
  }

  if (dryRun) {
    return { opened: true, kind: strategy.kind, mode: strategy.mode, hint: null, reason: null }
  }

  // macOS new window: AppleScript do script (no in front window, no create tab)
  if (strategy.template?.kind === "macos-window") {
    const app = strategy.template.app
    const escaped = escapeAppleScript(attachCmd)
    const script = `tell application "${app}" to do script "${escaped}"`
    try {
      await run("osascript", ["-e", script], { env })
      return { opened: true, kind: strategy.kind, mode: "window", hint: null, reason: null }
    } catch (err) {
      log?.(`[terminal] launch failed: ${err?.message ?? err}`)
      return { opened: false, kind: strategy.kind, mode: "hint", hint: attachCmd, reason: "osascript failed" }
    }
  }

  // macOS tab: AppleScript targeting front window (terminal) or new tab (iTerm)
  if (strategy.template?.kind === "macos-tab") {
    const app = strategy.template.app
    const escaped = escapeAppleScript(attachCmd)
    const script = app === "Terminal"
      ? `tell application "Terminal" to do script "${escaped}" in front window`
      : `tell application "iTerm" to create tab with default profile command "${escaped}"`
    try {
      await run("osascript", ["-e", script], { env })
      return { opened: true, kind: strategy.kind, mode: "tab", hint: null, reason: null }
    } catch (err) {
      log?.(`[terminal] launch failed: ${err?.message ?? err}`)
      return { opened: false, kind: strategy.kind, mode: "hint", hint: attachCmd, reason: "osascript failed" }
    }
  }

  // argv-subst: substitute attachCmd into argv template
  if (strategy.template?.kind === "argv-subst") {
    const argv = strategy.template.argv.map((a) => a.replace(/__ATTACH_CMD__/g, attachCmd))
    try {
      await run(argv[0], argv.slice(1), { env })
      return { opened: true, kind: strategy.kind, mode: strategy.mode, hint: null, reason: null }
    } catch (err) {
      log?.(`[terminal] launch failed: ${err?.message ?? err}`)
      return { opened: false, kind: strategy.kind, mode: "hint", hint: attachCmd, reason: "launch failed" }
    }
  }

  // No template (hint case)
  return { opened: false, kind: strategy.kind, mode: "hint", hint: attachCmd, reason: strategy.reason }
}

// tryAttachOrPrint(name, opts)
// opts: { env, platform, openTerminalFn, spawnSyncFn } — all optional.
//   env defaults to process.env, platform to process.platform,
//   openTerminalFn defaults to openTerminal, spawnSyncFn to child_process.spawnSync.
// Returns one of:
//   { ok: true, kind: "openTerminal", detail: string }
//     openTerminal opened a terminal for the session.
//   { ok: true, kind: "tmux-new-window", detail: string }
//     openTerminal failed but TMUX env was set and `tmux new-window -t <name>` succeeded.
//   { ok: false, command: string }
//     Nothing worked; caller should print the command for the user to run.
export async function tryAttachOrPrint(name, opts = {}) {
  const env = opts.env ?? process.env
  const platform = opts.platform ?? process.platform
  const openTerminalFn = opts.openTerminalFn ?? openTerminal
  const spawnSyncFn = opts.spawnSyncFn ?? spawnSync
  const attachCmd = buildAttachCommand(name)

  let opened
  try {
    opened = await openTerminalFn({ name, platform, env })
  } catch (err) {
    opened = { opened: false, kind: "none", mode: "hint", hint: attachCmd, reason: `openTerminal threw: ${err?.message ?? err}` }
  }

  if (opened?.opened) {
    const detail = opened.mode === "tab"
      ? `tab of ${opened.kind}`
      : opened.mode === "window"
        ? `new window of ${opened.kind}`
        : `${opened.kind}`
    return { ok: true, kind: "openTerminal", detail }
  }

  // Fallback: inside an existing tmux session, spawn a new window.
  if (env?.TMUX) {
    try {
      const res = spawnSyncFn("tmux", ["new-window", "-t", name], { env })
      const status = res?.status ?? 1
      if (status === 0) {
        return { ok: true, kind: "tmux-new-window", detail: "tmux new-window" }
      }
    } catch {
      // fall through to fallback command
    }
  }

  return { ok: false, command: attachCmd }
}
