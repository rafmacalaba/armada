import { test } from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readdirSync } from "node:fs"
import { join } from "node:path"

// Find all test files except this one
const testDir = join(import.meta.dirname)
const testFiles = readdirSync(testDir)
  .filter((f) => f.endsWith(".test.js") && f !== "no-invasive-terminals.test.js" && f !== "non-git-error.test.js")
  .sort()

test("full suite finishes in headless env (no hanging terminal opens)", async () => {
  const child = spawn(process.execPath, ["--test", ...testFiles], {
    cwd: join(testDir, ".."),
    env: {
      PATH: "/usr/bin:/bin",
      HOME: process.env.HOME || "/tmp",
      // Must keep HOME so git can find global config, but strip everything else
      // that would let a terminal open succeed.
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  let stdout = ""
  let stderr = ""
  child.stdout?.on("data", (d) => { stdout += d.toString() })
  child.stderr?.on("data", (d) => { stderr += d.toString() })

  const finished = new Promise((resolve) => {
    child.on("close", (code) => resolve({ code }))
    child.on("error", (err) => resolve({ code: null, error: err }))
  })

  const timedOut = await Promise.race([
    finished.then((r) => ({ ...r, hung: false })),
    new Promise((resolve) => setTimeout(() => resolve({ hung: true }), 8000)),
  ])

  if (timedOut.hung) {
    child.kill("SIGKILL")
    assert.fail(
      `test suite hung in headless env — a test is opening a real terminal\nstdout: ${stdout.slice(0, 2000)}\nstderr: ${stderr.slice(0, 2000)}`
    )
  }

  assert.ok(true, `suite exited with code ${timedOut.code} in headless env`)
})
