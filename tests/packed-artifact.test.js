import { test } from "node:test"
import assert from "node:assert"
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const dock = process.cwd()
const pkg = JSON.parse(readFileSync(join(dock, "package.json"), "utf8"))

test("test:packed script exists in package.json", () => {
  assert.ok(pkg.scripts["test:packed"], "package.json must have test:packed script")
})

test("npm run test:packed passes", () => {
  try {
    const out = execSync("npm run test:packed", {
      cwd: dock,
      encoding: "utf8",
      timeout: 120_000,
      stdio: "pipe",
    })
    // output already printed by child process; capture for assertion
    assert.ok(out.includes("PASS:"), "test:packed must print PASS")
  } catch (err) {
    // re-throw with stderr visible
    assert.fail(`npm run test:packed failed (exit ${err.status}):\n${err.stderr || err.stdout}`)
  }
})
