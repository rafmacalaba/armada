import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

import { armadaVoyageFinish, skillRegistry } from "../src/skills/index.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, "..")
const SKILL_REL = ".opencode/skills/armada-voyage-finish/SKILL.md"

// --- Unit: skill registration ---

test("armadaVoyageFinish is exported from skills index", () => {
  assert.ok(armadaVoyageFinish, "armadaVoyageFinish must be truthy")
})

test("armadaVoyageFinish is in the skillRegistry array", () => {
  const found = skillRegistry.find((s) => s.name === "armada-voyage-finish")
  assert.ok(found, "armada-voyage-finish must be in skillRegistry")
})

test("name matches ^armada-voyage-finish$", () => {
  assert.match(armadaVoyageFinish.name, /^armada-voyage-finish$/)
})

test("description is <= 200 chars", () => {
  assert.ok(armadaVoyageFinish.description.length <= 200,
    `description length ${armadaVoyageFinish.description.length} must be <= 200`)
})

test("body is non-empty", () => {
  assert.ok(armadaVoyageFinish.body.length > 0, "body must not be empty")
})

test("body contains all 5 ordered step keywords", () => {
  const body = armadaVoyageFinish.body
  const keywords = ["rebase", "TODO", "regen", "push", "PR"]
  for (const kw of keywords) {
    assert.ok(body.includes(kw), `body must contain keyword "${kw}"`)
  }
})

test("body contains explicit forbids", () => {
  const body = armadaVoyageFinish.body
  assert.ok(body.includes("REQUIREMENTS.md"), "body must forbid REQUIREMENTS.md")
  assert.ok(body.includes("npm publish"), "body must forbid npm publish")
})

test("frontmatter contains name: armada-voyage-finish", () => {
  const body = armadaVoyageFinish.body
  assert.ok(body.startsWith("---"), "body must start with frontmatter")
  const fmEnd = body.indexOf("---\n", 3)
  assert.ok(fmEnd !== -1, "frontmatter closing --- must exist")
  const fm = body.slice(4, fmEnd)
  assert.match(fm, /name:\s*armada-voyage-finish/)
})

// --- Scaffold e2e ---

test("scaffold: init --from-armada writes skill into .opencode/skills/", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-vf-e2e-"))
  try {
    execFileSync(process.execPath, [
      join(PROJECT_ROOT, "src/cli.js"), "init", "--yes", "--target", dir,
    ], { cwd: PROJECT_ROOT, timeout: 30000, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })

    assert.ok(existsSync(join(dir, "armada/armada.yaml")), "armada.yaml must exist")

    execFileSync(process.execPath, [
      join(PROJECT_ROOT, "src/cli.js"), "init", "--from-armada", "armada/armada.yaml", "--target", dir,
    ], { cwd: dir, timeout: 30000, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })

    const skillPath = join(dir, SKILL_REL)
    assert.ok(existsSync(skillPath), "skill SKILL.md must be scaffolded")
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
})

test("scaffold: skill body matches registry byte-for-byte", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-vf-byte-"))
  try {
    execFileSync(process.execPath, [
      join(PROJECT_ROOT, "src/cli.js"), "init", "--yes", "--target", dir,
    ], { cwd: PROJECT_ROOT, timeout: 30000, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })

    execFileSync(process.execPath, [
      join(PROJECT_ROOT, "src/cli.js"), "init", "--from-armada", "armada/armada.yaml", "--target", dir,
    ], { cwd: dir, timeout: 30000, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })

    const onDisk = readFileSync(join(dir, SKILL_REL), "utf8")
    assert.strictEqual(onDisk, armadaVoyageFinish.body,
      "scaffolded SKILL.md must match registry body byte-for-byte")
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
})

// --- Round-trip stability ---

test("round-trip: re-scaffold produces identical SKILL.md", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-vf-rt-"))
  try {
    execFileSync(process.execPath, [
      join(PROJECT_ROOT, "src/cli.js"), "init", "--yes", "--target", dir,
    ], { cwd: PROJECT_ROOT, timeout: 30000, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })

    execFileSync(process.execPath, [
      join(PROJECT_ROOT, "src/cli.js"), "init", "--from-armada", "armada/armada.yaml", "--target", dir,
    ], { cwd: dir, timeout: 30000, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })

    const first = readFileSync(join(dir, SKILL_REL), "utf8")

    execFileSync(process.execPath, [
      join(PROJECT_ROOT, "src/cli.js"), "init", "--from-armada", "armada/armada.yaml", "--target", dir,
    ], { cwd: dir, timeout: 30000, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })

    const second = readFileSync(join(dir, SKILL_REL), "utf8")
    assert.strictEqual(first, second, "re-scaffold must produce byte-identical SKILL.md")
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
})
