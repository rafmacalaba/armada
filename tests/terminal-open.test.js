import { test } from "node:test"
import assert from "node:assert/strict"
import { tryAttachOrPrint, buildAttachCommand } from "../src/terminal-open.js"

test("tryAttachOrPrint returns ok openTerminal when openTerminalFn resolves opened=true", async () => {
  const result = await tryAttachOrPrint("myname", {
    platform: "darwin",
    env: { PATH: "/usr/bin", HOME: "/tmp" },
    openTerminalFn: async () => ({ opened: true, kind: "iTerm", mode: "tab", hint: null, reason: null }),
  })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.kind, "openTerminal")
  assert.ok(typeof result.detail === "string" && result.detail.length > 0)
})

test("tryAttachOrPrint returns tmux-new-window when openTerminal fails and TMUX env set", async () => {
  const calls = []
  const result = await tryAttachOrPrint("myname", {
    platform: "linux",
    env: { PATH: "/usr/bin", TMUX: "/tmp/tmux-1000/default,123,0" },
    openTerminalFn: async () => ({ opened: false, kind: "none", mode: "hint", hint: "tmux attach -t 'myname'", reason: "no terminal" }),
    spawnSyncFn: (bin, args) => {
      calls.push({ bin, args })
      return { status: 0, stdout: "", stderr: "" }
    },
  })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.kind, "tmux-new-window")
  assert.ok(calls.length === 1, "spawnSync called exactly once")
  assert.strictEqual(calls[0].bin, "tmux")
  assert.deepEqual(calls[0].args, ["new-window", "-t", "myname"])
})

test("tryAttachOrPrint returns ok=false fallback command when openTerminal fails and no TMUX env", async () => {
  const result = await tryAttachOrPrint("myname", {
    platform: "linux",
    env: { PATH: "/usr/bin" },
    openTerminalFn: async () => ({ opened: false, kind: "none", mode: "hint", hint: "tmux attach -t 'myname'", reason: "no terminal" }),
  })
  assert.strictEqual(result.ok, false)
  assert.strictEqual(result.command, buildAttachCommand("myname"))
  assert.strictEqual(result.command, "tmux attach -t 'myname'")
})

test("tryAttachOrPrint returns ok=false fallback when TMUX set but spawnSync fails", async () => {
  const result = await tryAttachOrPrint("myname", {
    platform: "linux",
    env: { PATH: "/usr/bin", TMUX: "/tmp/tmux-1000/default,123,0" },
    openTerminalFn: async () => ({ opened: false, kind: "none", mode: "hint", hint: "tmux attach -t 'myname'", reason: "no terminal" }),
    spawnSyncFn: () => ({ status: 1, stdout: "", stderr: "no server" }),
  })
  assert.strictEqual(result.ok, false)
  assert.strictEqual(result.command, "tmux attach -t 'myname'")
})

test("tryAttachOrPrint escapes single quotes in the name for the fallback command", async () => {
  const result = await tryAttachOrPrint("na'me", {
    platform: "linux",
    env: { PATH: "/usr/bin" },
    openTerminalFn: async () => ({ opened: false, kind: "none", mode: "hint", hint: "", reason: "no terminal" }),
  })
  assert.strictEqual(result.ok, false)
  assert.strictEqual(result.command, "tmux attach -t 'na'\\''me'")
})

test("tryAttachOrPrint uses default openTerminal when openTerminalFn omitted", async () => {
  // Headless linux, no DISPLAY -> openTerminal returns opened=false
  const result = await tryAttachOrPrint("myname", {
    platform: "linux",
    env: { PATH: "/usr/bin" },
  })
  assert.strictEqual(result.ok, false)
  assert.strictEqual(result.command, "tmux attach -t 'myname'")
})
