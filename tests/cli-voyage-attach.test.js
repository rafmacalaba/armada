import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runCli, spawnCli, makeBin } from "./helpers.js"

function makeAttachBin(opts = {}) {
  const homeDir = mkdtempSync(join(tmpdir(), "armada-attach-home-"))
  return {
    binDir: makeBin({
      tmux: "#!/bin/sh\nexit 0\n",
      ...(opts.wezterm ? { wezterm: "#!/bin/sh\nexit 0\n" } : {}),
    }),
    homeDir,
  }
}

test("voyage attach <name> prints fallback command when no terminal available", async () => {
  const { binDir, homeDir } = makeAttachBin()
  const r = await spawnCli(["voyage", "attach", "mytest"], {
    env: { PATH: `${binDir}:/bin`, HOME: homeDir, TERM_PROGRAM: "", VSCODE_IPC_HOOK_CLI: "" },
  })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /tmux attach -t 'mytest'/)
})

test("voyage attach <name> prints confirmation when terminal available", async () => {
  const { binDir, homeDir } = makeAttachBin({ wezterm: true })
  const r = await runCli(["voyage", "attach", "secondtest"], {
    env: { PATH: binDir, HOME: homeDir, TERM_PROGRAM: "WezTerm" },
  })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /armada voyage attach: opened/)
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
