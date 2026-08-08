import { test } from "node:test"
import assert from "node:assert/strict"
import { runCli, makeBin } from "./helpers.js"

// Returns { fakeBin, envExtra } with platform terminal fakes so no real
// Terminal/iTerm/wezterm/wt window is ever opened during testing.
function makeAttachBin() {
  const plat = process.platform
  const fakeBin = {
    tmux: "#!/bin/sh\nexit 0\n",
    // Fake all terminal openers that openTerminal probes via which(),
    // including wezterm (can be installed on any platform).
    wezterm: "#!/bin/sh\nexit 0\n",
    "gnome-terminal": "#!/bin/sh\nexit 0\n",
    konsole: "#!/bin/sh\nexit 0\n",
    "x-terminal-emulator": "#!/bin/sh\nexit 0\n",
    wt: "@echo off\nexit /b 0\n",
  }
  const envExtra = { DISPLAY: "", TERM_PROGRAM: "", VSCODE_IPC_HOOK_CLI: "" }
  if (plat === "darwin") {
    fakeBin.osascript = "#!/bin/sh\nexit 0\n"
    fakeBin.open = "#!/bin/sh\nexit 0\n"
  }
  return { fakeBin, envExtra }
}

test("voyage attach <name> opens terminal or prints fallback command", async () => {
  const { fakeBin, envExtra } = makeAttachBin()
  const binDir = makeBin(fakeBin)
  const r = await runCli(["voyage", "attach", "mytest"], {
    env: { PATH: binDir, ...envExtra },
  })
  assert.strictEqual(r.code, 0)
  const opened = /armada voyage attach: opened/.test(r.stdout)
  const fallback = /tmux attach -t 'mytest'/.test(r.stdout)
  assert.ok(opened || fallback, `expected opened line or fallback command, got: ${r.stdout}`)
})

test("voyage attach <name> prints confirmation when terminal available", async () => {
  const { fakeBin, envExtra } = makeAttachBin()
  const binDir = makeBin(fakeBin)
  const r = await runCli(["voyage", "attach", "secondtest"], { env: { PATH: binDir, ...envExtra } })
  assert.strictEqual(r.code, 0)
  const opened = /armada voyage attach: opened/.test(r.stdout)
  const fallback = /tmux attach -t 'secondtest'/.test(r.stdout)
  assert.ok(opened || fallback, `expected opened or fallback, got: ${r.stdout}`)
})

test("voyage attach with no name exits 1", async () => {
  const r = await runCli(["voyage", "attach"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /Usage: armada voyage attach <name>/)
})

test("voyage attach name starting with -- exits 1", async () => {
  const r = await runCli(["voyage", "attach", "--weird"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /Usage: armada voyage attach <name>/)
})
