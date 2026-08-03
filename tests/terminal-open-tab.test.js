import { test } from "node:test"
import assert from "node:assert"
import { pickAttachStrategy, pickTerminal } from "../src/terminal-open.js"

// --- c1: macOS + TERM_PROGRAM=Apple_Terminal ---

test("c1: macOS + TERM_PROGRAM=Apple_Terminal returns tab strategy for Terminal.app", () => {
  const s = pickAttachStrategy({
    env: { TERM_PROGRAM: "Apple_Terminal" },
    os: "macos",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "tab")
  assert.strictEqual(s.kind, "Terminal.app")
  assert.deepStrictEqual(s.template, { kind: "macos-tab", app: "Terminal" })
  assert.strictEqual(s.available, true)
  assert.strictEqual(s.reason, null)
  assert.strictEqual(s.hint, null)
})

// --- c2: macOS + TERM_PROGRAM=iTerm.app ---

test("c2: macOS + TERM_PROGRAM=iTerm.app returns tab strategy for iTerm", () => {
  const s = pickAttachStrategy({
    env: { TERM_PROGRAM: "iTerm.app" },
    os: "macos",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "tab")
  assert.strictEqual(s.kind, "iTerm")
  assert.deepStrictEqual(s.template, { kind: "macos-tab", app: "iTerm" })
  assert.strictEqual(s.available, true)
  assert.strictEqual(s.reason, null)
  assert.strictEqual(s.hint, null)
})

// --- c3: TERM_PROGRAM=WezTerm (any os) ---

test("c3: TERM_PROGRAM=WezTerm (any os) returns tab strategy for wezterm via wezterm start", () => {
  const s = pickAttachStrategy({
    env: { TERM_PROGRAM: "WezTerm" },
    os: "linux",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "tab")
  assert.strictEqual(s.kind, "wezterm")
  assert.strictEqual(s.available, true)
  assert.strictEqual(s.reason, null)
  assert.strictEqual(s.hint, null)
  assert.strictEqual(s.template.kind, "argv-subst")
  assert.deepStrictEqual(s.template.argv, ["wezterm", "start", "--", "bash", "-c", "__ATTACH_CMD__; exec bash"])
})

// --- c4: TERM_PROGRAM=vscode returns hint ---

test("c4: TERM_PROGRAM=vscode returns hint (mode=hint, available=false, hint set)", () => {
  const s = pickAttachStrategy({
    env: { TERM_PROGRAM: "vscode" },
    os: "linux",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "hint")
  assert.strictEqual(s.kind, "none")
  assert.strictEqual(s.template, null)
  assert.strictEqual(s.available, false)
  assert.match(s.reason, /vscode integrated terminal cannot be addressed/)
  assert.strictEqual(s.hint, null)
})

// --- c4b: TERM_PROGRAM=cursor returns hint ---

test("c4b: TERM_PROGRAM=cursor returns hint", () => {
  const s = pickAttachStrategy({
    env: { TERM_PROGRAM: "cursor" },
    os: "macos",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "hint")
  assert.strictEqual(s.kind, "none")
  assert.strictEqual(s.available, false)
  assert.match(s.reason, /cursor integrated terminal cannot be addressed/)
  assert.strictEqual(s.hint, null)
})

// --- c4c: VSCODE_IPC_HOOK_CLI set (no TERM_PROGRAM) returns hint ---

test("c4c: VSCODE_IPC_HOOK_CLI set (no TERM_PROGRAM) returns hint", () => {
  const s = pickAttachStrategy({
    env: { VSCODE_IPC_HOOK_CLI: "some-value" },
    os: "linux",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "hint")
  assert.strictEqual(s.kind, "none")
  assert.strictEqual(s.available, false)
  assert.match(s.reason, /vscode integrated terminal cannot be addressed/)
  assert.strictEqual(s.hint, null)
})

// --- c5: no TERM_PROGRAM, os=macos delegates to pickTerminal ---

test("c5: no TERM_PROGRAM, os=macos delegates to pickTerminal — mode=window, kind=Terminal.app", () => {
  const s = pickAttachStrategy({
    env: {},
    os: "macos",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "window")
  assert.strictEqual(s.kind, "Terminal.app")
  assert.strictEqual(s.available, true)
  assert.strictEqual(s.hint, null)
  assert.strictEqual(s.template.kind, "macos-window")
  assert.strictEqual(s.template.app, "Terminal")
})

// --- c5b: no TERM_PROGRAM, os=linux + hasWeztermServer=true → wezterm tab ---

test("c5b: no TERM_PROGRAM, os=linux + hasWeztermServer=true → wezterm tab strategy", () => {
  const s = pickAttachStrategy({
    env: {},
    os: "linux",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: true,
  })
  assert.strictEqual(s.mode, "tab")
  assert.strictEqual(s.kind, "wezterm")
  assert.strictEqual(s.available, true)
  assert.strictEqual(s.template.kind, "argv-subst")
  assert.deepStrictEqual(s.template.argv, ["wezterm", "start", "--", "bash", "-c", "__ATTACH_CMD__; exec bash"])
})

// --- c5c: no TERM_PROGRAM, os=linux + hasWeztermServer=false delegates to pickTerminal ---

test("c5c: no TERM_PROGRAM, os=linux + hasWeztermServer=false delegates to pickTerminal", () => {
  const s = pickAttachStrategy({
    env: {},
    os: "linux",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "window")
  assert.strictEqual(s.kind, "none")
  assert.strictEqual(s.available, false)
  assert.match(s.reason, /no X terminal/)
})

// --- c5d: TERM_PROGRAM=tmux (unrecognized) on macos delegates to pickTerminal ---

test("c5d: TERM_PROGRAM=tmux (unrecognized) on macos delegates to pickTerminal (rule 6)", () => {
  const s = pickAttachStrategy({
    env: { TERM_PROGRAM: "tmux" },
    os: "macos",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "window")
  assert.strictEqual(s.kind, "Terminal.app")
  assert.strictEqual(s.available, true)
})

// --- c5e: TERM_PROGRAM=screen (unrecognized) on linux delegates to pickTerminal ---

test("c5e: TERM_PROGRAM=screen (unrecognized) on linux delegates to pickTerminal", () => {
  const s = pickAttachStrategy({
    env: { TERM_PROGRAM: "screen" },
    os: "linux",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "window")
  assert.strictEqual(s.kind, "none")
  assert.strictEqual(s.available, false)
  assert.match(s.reason, /no X terminal/)
})

// --- c6: vscode takes precedence over wezterm server ---

test("c6: vscode takes precedence over wezterm server — TERM_PROGRAM=vscode AND hasWeztermServer=true → hint, not wezterm tab", () => {
  const s = pickAttachStrategy({
    env: { TERM_PROGRAM: "vscode" },
    os: "linux",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: true,
  })
  assert.strictEqual(s.mode, "hint")
  assert.strictEqual(s.kind, "none")
  assert.strictEqual(s.available, false)
  assert.match(s.reason, /vscode integrated terminal/)
})

// --- c7: hint strategy has hint set, template=null, available=false ---

test("c7: hint strategy has hint set, template=null, available=false", () => {
  const s = pickAttachStrategy({
    env: { TERM_PROGRAM: "cursor" },
    os: "macos",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "hint")
  assert.strictEqual(s.template, null)
  assert.strictEqual(s.available, false)
  assert.strictEqual(s.hint, null)
})

// --- c8: argv-subst template for gnome-terminal contains __ATTACH_CMD__ ---

test("c8: argv-subst template for gnome-terminal contains __ATTACH_CMD__ (preserved from existing pickTerminal)", () => {
  const s = pickAttachStrategy({
    env: {},
    os: "linux",
    whichResults: { gnomeTerminal: "/usr/bin/gnome-terminal" },
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "window")
  assert.strictEqual(s.kind, "gnome-terminal")
  assert.strictEqual(s.template.kind, "argv-subst")
  assert.ok(s.template.argv.some((a) => a.includes("__ATTACH_CMD__")),
    "argv-subst template must contain __ATTACH_CMD__ placeholder")
})

// --- DEF-028: KONSOLE_VERSION detection ---

test("DEF-028a: KONSOLE_VERSION set → konsole tab strategy (mode=tab, kind=konsole, argv with --new-tab)", () => {
  const s = pickAttachStrategy({
    env: { KONSOLE_VERSION: "24.02.0" },
    os: "linux",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "tab")
  assert.strictEqual(s.kind, "konsole")
  assert.strictEqual(s.available, true)
  assert.strictEqual(s.template.kind, "argv-subst")
  assert.deepStrictEqual(s.template.argv, ["konsole", "--new-tab", "-e", "bash", "-c", "__ATTACH_CMD__; exec bash"])
})

test("DEF-028b: KONSOLE_VERSION not set, konsole on PATH → new-window via classic (mode=window, kind=konsole, argv has -e)", () => {
  const s = pickAttachStrategy({
    env: {},
    os: "linux",
    whichResults: { konsole: "/usr/bin/konsole" },
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "window")
  assert.strictEqual(s.kind, "konsole")
  assert.strictEqual(s.available, true)
  assert.strictEqual(s.template.kind, "argv-subst")
  assert.deepStrictEqual(s.template.argv, ["konsole", "-e", "bash", "-c", "__ATTACH_CMD__; exec bash"])
})

// --- DEF-021 / ADV-038: Windows + hasWeztermServer=true excludes wezterm (os guard) ---

test("DEF-021: Windows + hasWeztermServer=true excludes wezterm (os guard)", () => {
  const s = pickAttachStrategy({
    os: "windows",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: true,
    env: {},
  })
  assert.strictEqual(s.mode, "window")
  assert.notStrictEqual(s.kind, "wezterm")
})

// --- DEF-022 / ADV-039: Rules 1-3 vs rule 5 precedence ---

test("DEF-022a: Apple_Terminal + hasWeztermServer=true returns Terminal.app tab (rule 1 wins over rule 5)", () => {
  const s = pickAttachStrategy({
    env: { TERM_PROGRAM: "Apple_Terminal" },
    os: "macos",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: true,
  })
  assert.strictEqual(s.mode, "tab")
  assert.strictEqual(s.kind, "Terminal.app")
})

test("DEF-022b: iTerm.app + hasWeztermServer=true returns iTerm tab (rule 2 wins over rule 5)", () => {
  const s = pickAttachStrategy({
    env: { TERM_PROGRAM: "iTerm.app" },
    os: "macos",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: true,
  })
  assert.strictEqual(s.mode, "tab")
  assert.strictEqual(s.kind, "iTerm")
})

test("DEF-022c: WezTerm + hasWeztermServer=true returns wezterm tab (rule 3 wins; both agree)", () => {
  const s = pickAttachStrategy({
    env: { TERM_PROGRAM: "WezTerm" },
    os: "linux",
    whichResults: {},
    hasDisplay: true,
    hasWeztermServer: true,
  })
  assert.strictEqual(s.mode, "tab")
  assert.strictEqual(s.kind, "wezterm")
})

// --- DEF-023 / ADV-040: TERM_PROGRAM="" empty string ---

test("DEF-023: TERM_PROGRAM=\"\" empty string falls through to rule 6 → pickTerminal", () => {
  const s = pickAttachStrategy({
    env: { TERM_PROGRAM: "" },
    os: "macos",
    whichResults: { iTerm: "/Applications/iTerm.app" },
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "window")
  assert.strictEqual(s.kind, "iTerm")
})

// --- DEF-024 / ADV-041: env undefined / null ---

test("DEF-024a: env undefined falls through to rule 6 → pickTerminal", () => {
  const s = pickAttachStrategy({
    os: "macos",
    whichResults: { iTerm: "/Applications/iTerm.app" },
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "window")
  assert.strictEqual(s.kind, "iTerm")
})

test("DEF-024b: env null does not throw, falls through to rule 6 → pickTerminal", () => {
  const s = pickAttachStrategy({
    env: null,
    os: "linux",
    whichResults: { gnomeTerminal: "/usr/bin/gnome-terminal" },
    hasDisplay: true,
    hasWeztermServer: false,
  })
  assert.strictEqual(s.mode, "window")
  assert.strictEqual(s.kind, "gnome-terminal")
})

// --- pickTerminal backwards compat (thin wrapper) ---

test("pickTerminal backwards compat: returns original shape fields only", () => {
  const r = pickTerminal({
    os: "macos",
    whichResults: {},
    hasDisplay: true,
  })
  assert.strictEqual(r.kind, "Terminal.app")
  assert.deepStrictEqual(r.argv, ["open", "-a", "Terminal"])
  assert.strictEqual(r.attachCmd, "")
  assert.strictEqual(r.available, true)
  assert.strictEqual(r.reason, null)
  assert.strictEqual(r.mode, undefined)
  assert.strictEqual(r.template, undefined)
  assert.strictEqual(r.hint, undefined)
})
