import { test } from "node:test"
import assert from "node:assert"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const CLI = join(process.cwd(), "src", "cli.js")

function runCli(args) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    cwd: process.cwd(),
  })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

// Phase 2: armada update is deprecated, prints hint, calls init
test("update: prints deprecation hint on stderr, calls init", () => {
  // init without args in non-TTY prints a basic help/catalog
  const result = runCli(["update"])
  assert.match(result.stderr, /armada update: deprecated/)
  assert.match(result.stderr, /armada init --from-armada --restart/)
  // init in non-TTY without cwd produces basic init output
  assert.match(result.stdout, /Scaffolded|Usage:/)
})
