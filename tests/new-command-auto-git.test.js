import { test } from "node:test"
import assert from "node:assert"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { runNew } from "../src/new-command.js"

function makeTempDir() {
  const dir = join(tmpdir(), "armada-new-git-" + Math.random().toString(36).slice(2))
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

test("auto git init in runNew -- success", async () => {
  const cwd = makeTempDir()
  const targetDir = join(cwd, "testproj")
  writeMinimalCatalog(cwd)

  try {
    const rc = await runNew({ name: "testproj", cwd, _catalogPath: join(cwd, "starter", "_catalog.json"), yes: true })
    assert.strictEqual(rc, 0)
    assert.ok(existsSync(join(targetDir, ".git")), ".git missing after runNew")
    assert.ok(existsSync(join(targetDir, "armada", "REQUIREMENTS.md")), "scaffold missing")
  } finally {
    try { rmSync(cwd, { recursive: true, force: true }) } catch {}
  }
})

test("auto git init in runNew -- --no-git skips silently", async () => {
  const cwd = makeTempDir()
  const targetDir = join(cwd, "testproj")
  writeMinimalCatalog(cwd)

  let stderrOut = ""
  const origError = console.error
  console.error = (msg) => { stderrOut += msg + "\n" }

  try {
    const rc = await runNew({ name: "testproj", cwd, _catalogPath: join(cwd, "starter", "_catalog.json"), yes: true, noGit: true })
    assert.strictEqual(rc, 0)
    assert.ok(existsSync(join(targetDir, "armada", "REQUIREMENTS.md")), "scaffold missing")
    assert.ok(!existsSync(join(targetDir, ".git")), ".git should not exist with --no-git")
    assert.ok(!stderrOut.toLowerCase().includes("git"), "no git warnings expected with --no-git")
  } finally {
    console.error = origError
    try { rmSync(cwd, { recursive: true, force: true }) } catch {}
  }
})

test("regression: runNew in non-git parent directory still succeeds (auto inits child)", async () => {
  const cwd = makeTempDir()
  const targetDir = join(cwd, "testproj")
  writeMinimalCatalog(cwd)

  try {
    const rc = await runNew({ name: "testproj", cwd, _catalogPath: join(cwd, "starter", "_catalog.json"), yes: true })
    assert.strictEqual(rc, 0)
    assert.ok(existsSync(join(targetDir, ".git")), ".git missing despite non-git parent")
    assert.ok(existsSync(join(targetDir, "armada", "REQUIREMENTS.md")), "scaffold missing")
  } finally {
    try { rmSync(cwd, { recursive: true, force: true }) } catch {}
  }
})
