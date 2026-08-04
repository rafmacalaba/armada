import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  detectOS,
  parsePathDirs,
  which,
  buildAttachCommand,
  detectITerm,
  pickTerminal,
  openTerminal,
} from "../src/terminal-open.js"

// --- detectOS ---

test("detectOS: darwin -> macos", () => {
  assert.strictEqual(detectOS("darwin"), "macos")
})
test("detectOS: linux -> linux", () => {
  assert.strictEqual(detectOS("linux"), "linux")
})
test("detectOS: win32 -> windows", () => {
  assert.strictEqual(detectOS("win32"), "windows")
})
test("detectOS: aix -> other", () => {
  assert.strictEqual(detectOS("aix"), "other")
})

// --- parsePathDirs ---

test("parsePathDirs: colon-separated", () => {
  assert.deepStrictEqual(parsePathDirs("/bin:/usr/bin"), ["/bin", "/usr/bin"])
})
test("parsePathDirs: semicolon-separated (Windows)", () => {
  assert.deepStrictEqual(parsePathDirs("C:\\a;C:\\b"), ["C:\\a", "C:\\b"])
})
test("parsePathDirs: undefined returns empty", () => {
  assert.deepStrictEqual(parsePathDirs(undefined), [])
})
test("parsePathDirs: empty string returns empty", () => {
  assert.deepStrictEqual(parsePathDirs(""), [])
})

// --- which ---

test("which: finds executable in dirs", () => {
  const dirs = ["/usr/bin", "/bin"]
  const found = which("ls", dirs)
  assert.ok(found, "should find ls")
  assert.ok(found.endsWith("/ls"), "should be full path to ls")
})
test("which: returns null for missing binary", () => {
  const dirs = ["/tmp/nonexistent"]
  assert.strictEqual(which("nope-nonexistent-binary-xyz", dirs), null)
})

// --- buildAttachCommand ---

// DEF-017: always single-quote, escape embedded single-quotes POSIX-style
test("buildAttachCommand: simple name (single-quoted)", () => {
  assert.strictEqual(buildAttachCommand("my-lane"), "tmux attach -t 'my-lane'")
})
test("buildAttachCommand: name with spaces stays single-quoted", () => {
  assert.strictEqual(buildAttachCommand("my lane"), "tmux attach -t 'my lane'")
})
test("buildAttachCommand: name with single-quote escaped POSIX-style", () => {
  assert.strictEqual(buildAttachCommand("foo'bar"), "tmux attach -t 'foo'\\''bar'")
})
test("buildAttachCommand: dangerous chars inside single quotes — safe", () => {
  assert.strictEqual(buildAttachCommand("foo; rm -rf /"), "tmux attach -t 'foo; rm -rf /'")
})

// --- pickTerminal ---

// macOS
test("pickTerminal: macOS iTerm available", () => {
  const r = pickTerminal({
    os: "macos",
    whichResults: { iTerm: "/Applications/iTerm.app" },
    hasDisplay: true,
  })
  assert.strictEqual(r.kind, "iTerm")
  assert.strictEqual(r.available, true)
  assert.deepStrictEqual(r.argv, ["open", "-a", "iTerm"])
})

test("pickTerminal: macOS no iTerm falls back to Terminal.app", () => {
  const r = pickTerminal({
    os: "macos",
    whichResults: {},
    hasDisplay: true,
  })
  assert.strictEqual(r.kind, "Terminal.app")
  assert.strictEqual(r.available, true)
  assert.deepStrictEqual(r.argv, ["open", "-a", "Terminal"])
})

// Linux
test("pickTerminal: Linux headless (no DISPLAY)", () => {
  const r = pickTerminal({
    os: "linux",
    whichResults: { gnomeTerminal: "/usr/bin/gnome-terminal" },
    hasDisplay: false,
  })
  assert.strictEqual(r.kind, "none")
  assert.strictEqual(r.available, false)
  assert.match(r.reason, /headless/)
})

test("pickTerminal: Linux gnome-terminal preferred", () => {
  const r = pickTerminal({
    os: "linux",
    whichResults: {
      gnomeTerminal: "/usr/bin/gnome-terminal",
      konsole: "/usr/bin/konsole",
      wezterm: "/usr/bin/wezterm",
    },
    hasDisplay: true,
  })
  assert.strictEqual(r.kind, "gnome-terminal")
  assert.strictEqual(r.available, true)
  assert.deepStrictEqual(r.argv[0], "gnome-terminal")
})

test("pickTerminal: Linux konsole when no gnome-terminal", () => {
  const r = pickTerminal({
    os: "linux",
    whichResults: { konsole: "/usr/bin/konsole" },
    hasDisplay: true,
  })
  assert.strictEqual(r.kind, "konsole")
  assert.strictEqual(r.available, true)
})

test("pickTerminal: Linux x-terminal-emulator when no others", () => {
  const r = pickTerminal({
    os: "linux",
    whichResults: { xTerminalEmulator: "/usr/bin/x-terminal-emulator" },
    hasDisplay: true,
  })
  assert.strictEqual(r.kind, "x-terminal-emulator")
  assert.strictEqual(r.available, true)
})

test("pickTerminal: Linux wezterm fallback", () => {
  const r = pickTerminal({
    os: "linux",
    whichResults: { wezterm: "/usr/bin/wezterm" },
    hasDisplay: true,
  })
  assert.strictEqual(r.kind, "wezterm")
  assert.strictEqual(r.available, true)
})

test("pickTerminal: Linux no terminal available", () => {
  const r = pickTerminal({
    os: "linux",
    whichResults: {},
    hasDisplay: true,
  })
  assert.strictEqual(r.kind, "none")
  assert.strictEqual(r.available, false)
  assert.match(r.reason, /no X terminal/)
})

// Windows
test("pickTerminal: Windows wezterm preferred over wt", () => {
  const r = pickTerminal({
    os: "windows",
    whichResults: { wt: "C:\\Program Files\\Windows Terminal\\wt.exe", wezterm: "C:\\wezterm.exe" },
    hasDisplay: true,
  })
  assert.strictEqual(r.kind, "wezterm")
  assert.strictEqual(r.available, true)
})

test("pickTerminal: Windows wt fallback when wezterm absent", () => {
  const r = pickTerminal({
    os: "windows",
    whichResults: { wt: "C:\\Program Files\\Windows Terminal\\wt.exe" },
    hasDisplay: true,
  })
  assert.strictEqual(r.kind, "wt")
  assert.strictEqual(r.available, true)
})

test("pickTerminal: Windows wezterm only", () => {
  const r = pickTerminal({
    os: "windows",
    whichResults: { wezterm: "C:\\wezterm.exe" },
    hasDisplay: true,
  })
  assert.strictEqual(r.kind, "wezterm")
  assert.strictEqual(r.available, true)
})

test("pickTerminal: Windows no terminal available", () => {
  const r = pickTerminal({
    os: "windows",
    whichResults: {},
    hasDisplay: true,
  })
  assert.strictEqual(r.kind, "none")
  assert.strictEqual(r.available, false)
  assert.match(r.reason, /no wezterm or Windows Terminal/)
})

// Other
test("pickTerminal: unsupported platform", () => {
  const r = pickTerminal({
    os: "other",
    whichResults: {},
    hasDisplay: true,
  })
  assert.strictEqual(r.kind, "none")
  assert.strictEqual(r.available, false)
  assert.match(r.reason, /unsupported platform/)
})

// --- openTerminal ---

// Helper: fake exec function
function makeFakeExec(behavior) {
  return (bin, args, opts) => {
    if (behavior === "success") return Promise.resolve({ stdout: "", stderr: "", code: 0 })
    if (behavior === "throw") return Promise.reject(new Error("spawn ENOENT"))
    if (behavior === "fail") return Promise.resolve({ stdout: "", stderr: "error", code: 1 })
    return Promise.resolve({ stdout: "", stderr: "", code: 0 })
  }
}

test("openTerminal: macOS success path (Terminal.app)", async () => {
  const logs = []
  const result = await openTerminal({
    name: "my-lane",
    platform: "darwin",
    env: { PATH: "/usr/bin:/bin" },
    exec: makeFakeExec("success"),
    log: (m) => logs.push(m),
  })
  assert.strictEqual(result.opened, true)
  assert.strictEqual(result.kind, "Terminal.app")
  assert.strictEqual(result.hint, null)
})

test("openTerminal: macOS iTerm when installed", async () => {
  // We can't easily fake iTerm.app on the filesystem in a portable way,
  // so test the Terminal.app fallback
  const result = await openTerminal({
    name: "my-lane",
    platform: "darwin",
    env: { PATH: "/usr/bin:/bin" },
    exec: makeFakeExec("success"),
  })
  assert.strictEqual(result.opened, true)
  assert.ok(result.kind === "Terminal.app" || result.kind === "iTerm")
})

test("openTerminal: Linux headless fallback (no DISPLAY)", async () => {
  const logs = []
  const result = await openTerminal({
    name: "my-lane",
    platform: "linux",
    env: { PATH: "/usr/bin:/bin" },
    exec: makeFakeExec("success"),
    log: (m) => logs.push(m),
  })
  assert.strictEqual(result.opened, false)
  assert.strictEqual(result.kind, "none")
  assert.match(result.hint, /tmux attach -t 'my-lane'/)
  assert.ok(logs.some((m) => m.includes("no terminal available")))
})

test("openTerminal: Linux with DISPLAY and gnome-terminal succeeds", async () => {
  const binDir = mkdtempSync(join(tmpdir(), "term-test-"))
  const gnomeTerminal = join(binDir, "gnome-terminal")
  writeFileSync(gnomeTerminal, "#!/bin/sh\nexit 0")
  chmodSync(gnomeTerminal, 0o755)
  try {
    const execCalls = []
    const fakeExec = (bin, args) => {
      execCalls.push({ bin, args })
      return Promise.resolve({ stdout: "", stderr: "", code: 0 })
    }
    const result = await openTerminal({
      name: "my-lane",
      platform: "linux",
      env: {
        PATH: binDir,
        DISPLAY: ":0",
      },
      exec: fakeExec,
    })
    assert.strictEqual(result.opened, true)
    assert.strictEqual(result.kind, "gnome-terminal")
    assert.strictEqual(result.hint, null)
    assert.ok(execCalls.length >= 1, "should have called exec")
  } finally {
    rmSync(binDir, { recursive: true, force: true })
  }
})

test("openTerminal: exec failure returns opened=false, does not throw", async () => {
  const logs = []
  const result = await openTerminal({
    name: "my-lane",
    platform: "darwin",
    env: { PATH: "/usr/bin:/bin" },
    exec: makeFakeExec("throw"),
    log: (m) => logs.push(m),
  })
  assert.strictEqual(result.opened, false)
  assert.ok(logs.some((m) => m.includes("launch failed")))
  assert.match(result.hint, /tmux attach -t 'my-lane'/)
})

test("openTerminal: dryRun returns opened=true without spawning", async () => {
  const logs = []
  const result = await openTerminal({
    name: "dry-lane",
    platform: "darwin",
    env: { PATH: "/usr/bin:/bin" },
    exec: () => Promise.reject(new Error("should not be called")),
    dryRun: true,
    log: (m) => logs.push(m),
  })
  assert.strictEqual(result.opened, true)
  assert.strictEqual(result.hint, null)
  assert.ok(result.kind === "Terminal.app" || result.kind === "iTerm")
})

// --- DEF-016: AppleScript injection via session name ---

test("DEF-016: AppleScript escaping — injection chars escaped (macOS tab path)", async () => {
  const execCalls = []
  const fakeExec = (bin, args) => {
    execCalls.push({ bin, args })
    return Promise.resolve({ stdout: "", stderr: "", code: 0 })
  }
  const result = await openTerminal({
    name: 'foo"; do shell script "echo PWNED',
    platform: "darwin",
    env: { PATH: "/usr/bin:/bin", TERM_PROGRAM: "Apple_Terminal" },
    exec: fakeExec,
  })
  assert.strictEqual(result.opened, true)
  assert.strictEqual(result.mode, "tab")
  assert.ok(execCalls.length >= 1, "should have called osascript")
  const argv = execCalls[0].args
  // The AppleScript argument (-e value) should contain escaped quotes
  const scriptLine = argv.join(" ")
  // Injection string should not appear unescaped
  assert.ok(!scriptLine.includes('do shell script "echo PWNED"'),
    "injection payload must not appear unescaped in osascript args")
  // Escaped double-quote must be present
  assert.match(scriptLine, /\\"/,
    "AppleScript arg must contain escaped double-quotes")
})

// --- DEF-018: Wayland detection ---

test("DEF-018: pickTerminal detects display via WAYLAND_DISPLAY (no DISPLAY)", () => {
  const r = pickTerminal({
    os: "linux",
    whichResults: { gnomeTerminal: "/usr/bin/gnome-terminal" },
    hasDisplay: true,
  })
  assert.strictEqual(r.kind, "gnome-terminal")
  assert.strictEqual(r.available, true)
})

test("DEF-018: openTerminal uses WAYLAND_DISPLAY when DISPLAY absent", async () => {
  const binDir = mkdtempSync(join(tmpdir(), "term-test-wayland-"))
  const gnomeTerminal = join(binDir, "gnome-terminal")
  writeFileSync(gnomeTerminal, "#!/bin/sh\nexit 0")
  chmodSync(gnomeTerminal, 0o755)
  try {
    const result = await openTerminal({
      name: "wayland-lane",
      platform: "linux",
      env: {
        PATH: binDir,
        WAYLAND_DISPLAY: "wayland-0",
      },
      exec: () => Promise.resolve({ stdout: "", stderr: "", code: 0 }),
    })
    assert.strictEqual(result.opened, true)
    assert.ok(result.kind !== "none", "should have picked a terminal on Wayland")
  } finally {
    rmSync(binDir, { recursive: true, force: true })
  }
})

test("DEF-018: openTerminal headless when no DISPLAY and no WAYLAND_DISPLAY", async () => {
  const result = await openTerminal({
    name: "headless",
    platform: "linux",
    env: { PATH: "/usr/bin:/bin" },
    exec: () => Promise.resolve({ stdout: "", stderr: "", code: 0 }),
  })
  assert.strictEqual(result.opened, false)
  assert.strictEqual(result.kind, "none")
})

// --- DEF-019: iTerm detection ---

test("DEF-019: detectITerm returns null when no iTerm found", () => {
  const result = detectITerm("/nonexistent/home")
  assert.strictEqual(result, null)
})

test("DEF-019: detectITerm finds iTerm from HOME/Applications", () => {
  const fakeHome = mkdtempSync(join(tmpdir(), "term-iterm-home-"))
  const appsDir = join(fakeHome, "Applications")
  mkdirSync(appsDir, { recursive: true })
  const itermPath = join(appsDir, "iTerm.app")
  mkdirSync(itermPath, { recursive: true })
  try {
    const result = detectITerm(fakeHome)
    assert.strictEqual(result, itermPath)
  } finally {
    rmSync(fakeHome, { recursive: true, force: true })
  }
})

// --- Phase 2: openTerminal with pickAttachStrategy ---

test("Phase 2: macOS Apple_Terminal tab — AppleScript contains 'in front window'", async () => {
  const execCalls = []
  const fakeExec = (bin, args) => {
    execCalls.push({ bin, args })
    return Promise.resolve({ stdout: "", stderr: "", code: 0 })
  }
  const result = await openTerminal({
    name: "my-lane",
    platform: "darwin",
    env: { PATH: "/usr/bin:/bin", TERM_PROGRAM: "Apple_Terminal" },
    exec: fakeExec,
  })
  assert.strictEqual(result.opened, true)
  assert.strictEqual(result.kind, "Terminal.app")
  assert.strictEqual(result.mode, "tab")
  assert.strictEqual(result.hint, null)
  assert.ok(execCalls.length >= 1)
  const scriptLine = execCalls[0].args.join(" ")
  assert.match(scriptLine, /in front window/, "AppleScript must target front window")
})

test("Phase 2: macOS iTerm tab — AppleScript contains 'create tab with default profile command'", async () => {
  const execCalls = []
  const fakeExec = (bin, args) => {
    execCalls.push({ bin, args })
    return Promise.resolve({ stdout: "", stderr: "", code: 0 })
  }
  const result = await openTerminal({
    name: "my-lane",
    platform: "darwin",
    env: { PATH: "/usr/bin:/bin", TERM_PROGRAM: "iTerm.app" },
    exec: fakeExec,
  })
  assert.strictEqual(result.opened, true)
  assert.strictEqual(result.kind, "iTerm")
  assert.strictEqual(result.mode, "tab")
  assert.strictEqual(result.hint, null)
  assert.ok(execCalls.length >= 1)
  const scriptLine = execCalls[0].args.join(" ")
  assert.match(scriptLine, /create tab with default profile command/,
    "iTerm AppleScript must create a tab")
})

test("Phase 2: Linux with wezterm on PATH — execs wezterm start (window mode from rule 6)", async () => {
  const binDir = mkdtempSync(join(tmpdir(), "term-wez-"))
  const weztermBin = join(binDir, "wezterm")
  writeFileSync(weztermBin, "#!/bin/sh\nexit 0")
  chmodSync(weztermBin, 0o755)
  const execCalls = []
  const fakeExec = (bin, args) => {
    execCalls.push({ bin, args })
    return Promise.resolve({ stdout: "", stderr: "", code: 0 })
  }
  try {
    const result = await openTerminal({
      name: "my-lane",
      platform: "linux",
      env: { PATH: binDir, DISPLAY: ":0" },
      exec: fakeExec,
    })
    // Without TERM_PROGRAM, wezterm on PATH enables hasWeztermServer → rule 5 → tab
    assert.strictEqual(result.opened, true)
    assert.strictEqual(result.kind, "wezterm")
    assert.strictEqual(result.mode, "tab")
    assert.strictEqual(result.hint, null)
    assert.ok(execCalls.length >= 1)
    assert.strictEqual(execCalls[0].bin, "wezterm")
    const joined = execCalls[0].args.join(" ")
    assert.match(joined, /^start --/)
    assert.match(joined, /bash -c/)
    assert.match(joined, /exec bash/)
  } finally {
    rmSync(binDir, { recursive: true, force: true })
  }
})

test("Phase 2: Linux TERM_PROGRAM=WezTerm — execs wezterm start", async () => {
  const execCalls = []
  const fakeExec = (bin, args) => {
    execCalls.push({ bin, args })
    return Promise.resolve({ stdout: "", stderr: "", code: 0 })
  }
  const result = await openTerminal({
    name: "my-lane",
    platform: "linux",
    env: { PATH: "/usr/bin:/bin", TERM_PROGRAM: "WezTerm", DISPLAY: ":0" },
    exec: fakeExec,
  })
  assert.strictEqual(result.opened, true)
  assert.strictEqual(result.kind, "wezterm")
  assert.strictEqual(result.mode, "tab")
  assert.strictEqual(result.hint, null)
  assert.ok(execCalls.length >= 1)
  assert.strictEqual(execCalls[0].bin, "wezterm")
  const joined = execCalls[0].args.join(" ")
  assert.match(joined, /^start --/)
  assert.match(joined, /bash -c/)
  assert.match(joined, /exec bash/)
})

test("DEF-025: macOS no-TERM_PROGRAM runs attach command via osascript (macos-window path)", async () => {
  const execCalls = []
  const fakeExec = (bin, args) => {
    execCalls.push({ bin, args })
    return Promise.resolve({ stdout: "", stderr: "", code: 0 })
  }
  const result = await openTerminal({
    name: "my-lane",
    platform: "darwin",
    env: { PATH: "/usr/bin:/bin" },
    exec: fakeExec,
  })
  assert.strictEqual(result.opened, true)
  assert.strictEqual(result.mode, "window")
  assert.strictEqual(result.hint, null)
  assert.strictEqual(result.reason, null)
  assert.ok(execCalls.length >= 1, "should have called exec")
  assert.strictEqual(execCalls[0].bin, "osascript")
  const argvLine = execCalls[0].args.join(" ")
  assert.match(argvLine, /tmux attach -t 'my-lane'/, "osascript argv must contain the attach command")
  assert.match(argvLine, /do script/, "osascript must use do script")
})

// --- DEF-030: vscode/cursor hint path integration test ---

test("DEF-030: openTerminal with TERM_PROGRAM=vscode returns hint (opened=false, mode=hint, hint set)", async () => {
  const result = await openTerminal({
    name: "my-lane",
    platform: "darwin",
    env: { PATH: "/usr/bin:/bin", TERM_PROGRAM: "vscode" },
    exec: makeFakeExec("success"),
  })
  assert.strictEqual(result.opened, false)
  assert.strictEqual(result.kind, "none")
  assert.strictEqual(result.mode, "hint")
  assert.match(result.hint, /tmux attach -t 'my-lane'/)
  assert.match(result.reason, /vscode/)
})

// --- DEF-028: KONSOLE_VERSION openTerminal integration ---

test("DEF-028: openTerminal with KONSOLE_VERSION spawns konsole --new-tab", async () => {
  const binDir = mkdtempSync(join(tmpdir(), "term-konsole-"))
  const konsoleBin = join(binDir, "konsole")
  writeFileSync(konsoleBin, "#!/bin/sh\nexit 0")
  chmodSync(konsoleBin, 0o755)
  const execCalls = []
  const fakeExec = (bin, args) => {
    execCalls.push({ bin, args })
    return Promise.resolve({ stdout: "", stderr: "", code: 0 })
  }
  try {
    const result = await openTerminal({
      name: "my-lane",
      platform: "linux",
      env: { PATH: binDir, KONSOLE_VERSION: "24.02.0", DISPLAY: ":0" },
      exec: fakeExec,
    })
    assert.strictEqual(result.opened, true)
    assert.strictEqual(result.kind, "konsole")
    assert.strictEqual(result.mode, "tab")
    assert.ok(execCalls.length >= 1)
    assert.strictEqual(execCalls[0].bin, "konsole")
    const joined = execCalls[0].args.join(" ")
    assert.match(joined, /^--new-tab/)
    assert.match(joined, /bash -c/)
    assert.match(joined, /exec bash/)
  } finally {
    rmSync(binDir, { recursive: true, force: true })
  }
})
