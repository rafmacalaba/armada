import { test } from "node:test"
import assert from "node:assert"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { runNew } from "../src/new-command.js"
import { makeBin } from "./helpers.js"

function makeTempDir() {
  const dir = join(tmpdir(), "armada-new-git-mock-" + Math.random().toString(36).slice(2))
  mkdirSync(dir, { recursive: true })
  return dir
}

function writeMinimalCatalog(dir) {
  const catalogDir = join(dir, "starter", "blank")
  mkdirSync(catalogDir, { recursive: true })
  writeFileSync(join(dir, "starter", "_catalog.json"), JSON.stringify({
    categories: [{ id: "blank", dir: "starter/blank", defaultVars: {} }]
  }))
  writeFileSync(join(catalogDir, ".armada_keep"), "")
}

test("auto git init in runNew -- git not on PATH warns and continues", async () => {
  const cwd = makeTempDir()
  const targetDir = join(cwd, "testproj")
  writeMinimalCatalog(cwd)

  let stderrOut = ""
  const origError = console.error
  const origExit = process.exitCode
  console.error = (msg) => { stderrOut += msg + "\n" }

  const oldPath = process.env.PATH
  process.env.PATH = "/nonexistent"

  try {
    const rc = await runNew({ name: "testproj", cwd, _catalogPath: join(cwd, "starter", "_catalog.json"), yes: true })
    assert.strictEqual(rc, 0)
    assert.ok(stderrOut.includes("git not found on PATH"), `expected "git not found" warning, got: ${stderrOut}`)
    assert.ok(existsSync(join(targetDir, "armada", "REQUIREMENTS.md")), "scaffold missing despite git missing")
    assert.ok(!existsSync(join(targetDir, ".git")), ".git should not exist when git is missing")
  } finally {
    console.error = origError
    process.env.PATH = oldPath
    process.exitCode = origExit
    try { rmSync(cwd, { recursive: true, force: true }) } catch {}
  }
})

test("auto git init in runNew -- git init fails warns and continues", async () => {
  const cwd = makeTempDir()
  const targetDir = join(cwd, "testproj")
  writeMinimalCatalog(cwd)

  // Fake git: --version succeeds, everything else (including init) fails
  const fakeGitContent = `#!/bin/bash
if [[ "$1" == "--version" ]]; then
  echo "git version 2.40.0"
  exit 0
fi
echo "fatal: mock git init failure" >&2
exit 1
`
  const binDir = makeBin({ git: fakeGitContent })

  let stderrOut = ""
  const origError = console.error
  const origExit = process.exitCode
  console.error = (msg) => { stderrOut += msg + "\n" }

  const oldPath = process.env.PATH
  process.env.PATH = `${binDir}:${process.env.PATH || ""}`

  try {
    const rc = await runNew({ name: "testproj", cwd, _catalogPath: join(cwd, "starter", "_catalog.json"), yes: true })
    assert.strictEqual(rc, 0)
    assert.ok(stderrOut.includes("git init failed"), `expected "git init failed" warning, got: ${stderrOut}`)
    assert.ok(existsSync(join(targetDir, "armada", "REQUIREMENTS.md")), "scaffold missing despite git init failure")
    assert.ok(!existsSync(join(targetDir, ".git")), ".git should not exist when git init fails")
  } finally {
    console.error = origError
    process.env.PATH = oldPath
    process.exitCode = origExit
    try { rmSync(cwd, { recursive: true, force: true }) } catch {}
    try { rmSync(binDir, { recursive: true, force: true }) } catch {}
  }
})
