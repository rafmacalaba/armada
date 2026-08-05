import { test } from "node:test"
import assert from "node:assert"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const CLI = join(process.cwd(), "src/cli.js")
const EXPECTED = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).version

test("--version prints version and exits 0", () => {
  const r = spawnSync(process.execPath, [CLI, "--version"], { encoding: "utf8" })
  assert.strictEqual(r.status, 0, "exit code should be 0")
  assert.match(r.stdout, /armada/, "stdout should include 'armada'")
  assert.match(r.stdout, new RegExp(EXPECTED.replace(".", "\\.")), `stdout should include version '${EXPECTED}'`)
})

test("-v prints version and exits 0", () => {
  const r = spawnSync(process.execPath, [CLI, "-v"], { encoding: "utf8" })
  assert.strictEqual(r.status, 0, "exit code should be 0")
  assert.match(r.stdout, /armada/, "stdout should include 'armada'")
  assert.match(r.stdout, new RegExp(EXPECTED.replace(".", "\\.")), `stdout should include version '${EXPECTED}'`)
})
