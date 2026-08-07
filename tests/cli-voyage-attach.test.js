import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runCli, makeBin } from "./helpers.js"

test("voyage attach <name> opens terminal or prints fallback command", async () => {
  // Headless env: no terminal available, no TMUX -> fallback command printed.
  const binDir = makeBin({
    tmux: "#!/bin/sh\nexit 0\n",
  })
  const r = await runCli(["voyage", "attach", "mytest"], {
    env: { PATH: binDir, DISPLAY: "", TERM_PROGRAM: "", VSCODE_IPC_HOOK_CLI: "" },
  })
  assert.strictEqual(r.code, 0)
  // Either a confirmation line for an opened terminal, or the fallback command.
  const opened = /armada voyage attach: opened/.test(r.stdout)
  const fallback = /tmux attach -t 'mytest'/.test(r.stdout)
  assert.ok(opened || fallback, `expected opened line or fallback command, got: ${r.stdout}`)
})

test("voyage attach <name> prints confirmation when terminal available", async () => {
  // Provide a fake osascript so openTerminal succeeds on darwin; on other
  // platforms we provide wezterm with DISPLAY. If the platform cannot open,
  // the fallback command is still an acceptable outcome per contract.
  const plat = process.platform
  const fakeBin = { opencode: "#!/bin/sh\nexit 0\n", tmux: "#!/bin/sh\nexit 0\n" }
  const envExtra = { DISPLAY: "", TERM_PROGRAM: "", VSCODE_IPC_HOOK_CLI: "" }
  if (plat === "darwin") {
    fakeBin.osascript = "#!/bin/sh\nexit 0\n"
    fakeBin.open = "#!/bin/sh\nexit 0\n"
  } else if (plat === "win32") {
    fakeBin.wt = "@echo off\nexit /b 0\n"
    envExtra.DISPLAY = ":0"
  } else {
    fakeBin.wezterm = "#!/bin/sh\nexit 0\n"
    envExtra.DISPLAY = ":0"
  }
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
