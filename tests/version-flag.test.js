import { test } from "node:test"
import assert from "node:assert"
import { spawnSync } from "node:child_process"
import { join } from "node:path"

const CLI = join(process.cwd(), "src/cli.js")

test("--version prints version and exits 0", () => {
  const r = spawnSync(process.execPath, [CLI, "--version"], { encoding: "utf8" })
  assert.strictEqual(r.status, 0, "exit code should be 0")
  assert.match(r.stdout, /opencode-armada/, "stdout should include 'opencode-armada'")
  assert.match(r.stdout, /0\.7\.0/, "stdout should include version '0.7.0'")
})

test("-v prints version and exits 0", () => {
  const r = spawnSync(process.execPath, [CLI, "-v"], { encoding: "utf8" })
  assert.strictEqual(r.status, 0, "exit code should be 0")
  assert.match(r.stdout, /opencode-armada/, "stdout should include 'opencode-armada'")
  assert.match(r.stdout, /0\.7\.0/, "stdout should include version '0.7.0'")
})
