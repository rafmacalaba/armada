// tests/new-command.test.js (unit tests section)
import { test } from "node:test"
import assert from "node:assert"
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { detectExperience, renderTemplate, experienceDetectForDir } from "../src/new-command.js"
import { CATEGORIES } from "../src/recommendations.js"

test("detectExperience returns beginner or experienced", () => {
  const level = detectExperience()
  assert.ok(level === "beginner" || level === "experienced")
})

test("experienceDetectForDir detects experienced when .gitconfig exists", () => {
  const dir = join(tmpdir(), "armada-new-test-exp-" + Date.now())
  mkdirSync(dir, { recursive: true })
  mkdirSync(join(dir, "fake-home"), { recursive: true })
  writeFileSync(join(dir, "fake-home", ".gitconfig"), "[user]\nname = test\n")
  const level = experienceDetectForDir(join(dir, "fake-home"))
  assert.strictEqual(level, "experienced")
  rmSync(dir, { recursive: true, force: true })
})

test("experienceDetectForDir returns beginner when no signals", () => {
  const dir = join(tmpdir(), "armada-new-test-beg-" + Date.now())
  mkdirSync(dir, { recursive: true })
  const level = experienceDetectForDir(dir)
  assert.strictEqual(level, "beginner")
  rmSync(dir, { recursive: true, force: true })
})

test("renderTemplate copies and substitutes placeholders, skips starter.yaml", () => {
  const src = join(tmpdir(), "armada-new-src-" + Date.now())
  const dest = join(tmpdir(), "armada-new-dest-" + Date.now())
  mkdirSync(src, { recursive: true })
  mkdirSync(join(src, "sub"), { recursive: true })
  writeFileSync(join(src, "test.txt"), "Hello {name}!")
  writeFileSync(join(src, "sub", "nested.txt"), "{greeting}, {name}")
  writeFileSync(join(src, "starter.yaml"), "name: {name}")

  renderTemplate(src, dest, { name: "World", greeting: "Hi" })
  assert.strictEqual(readFileSync(join(dest, "test.txt"), "utf8"), "Hello World!")
  assert.strictEqual(readFileSync(join(dest, "sub", "nested.txt"), "utf8"), "Hi, World")
  assert.ok(!existsSync(join(dest, "starter.yaml")))
  rmSync(src, { recursive: true, force: true })
  rmSync(dest, { recursive: true, force: true })
})

test("renderTemplate leaves unknown placeholders intact", () => {
  const src = join(tmpdir(), "armada-new-unk-" + Date.now())
  const dest = join(tmpdir(), "armada-new-unk-dest-" + Date.now())
  mkdirSync(src, { recursive: true })
  writeFileSync(join(src, "test.txt"), "Hello {unknown}!")

  renderTemplate(src, dest, { name: "World" })
  assert.strictEqual(readFileSync(join(dest, "test.txt"), "utf8"), "Hello {unknown}!")
  rmSync(src, { recursive: true, force: true })
  rmSync(dest, { recursive: true, force: true })
})

import { runCli, makeTempRepo } from "./helpers.js"

test("new CLI creates project dir with armada config", async () => {
  const parent = makeTempRepo({})
  const r = await runCli(["new", "my-test-app", "--type", "web-app", "--beginner", "--yes"], { cwd: parent })
  assert.strictEqual(r.code, 0)
  const projDir = join(parent, "my-test-app")
  assert.ok(existsSync(projDir), "project dir missing")
  assert.ok(existsSync(join(projDir, "package.json")), "package.json missing")
  assert.ok(existsSync(join(projDir, "armada/armada.yaml")), "armada/armada.yaml missing")
  assert.ok(existsSync(join(projDir, "armada/REQUIREMENTS.md")), "armada/REQUIREMENTS.md missing")
  assert.ok(existsSync(join(projDir, ".opencode/agent/orchestrator.md")), "orchestrator agent file missing")
  assert.ok(existsSync(join(projDir, "src/app/layout.tsx")), "layout.tsx missing")
})

test("new CLI with unknown category errors", async () => {
  const parent = makeTempRepo({})
  const r = await runCli(["new", "bad", "--type", "nope", "--yes"], { cwd: parent })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /Unknown category/)
})

test("new CLI without name shows usage", async () => {
  const r = await runCli(["new"], { cwd: process.cwd() })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /Usage/)
})

test("new CLI rejects existing directory", async () => {
  const parent = makeTempRepo({ "exists": "dir" })
  const r = await runCli(["new", "exists", "--type", "web-app", "--beginner", "--yes"], { cwd: parent })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /already exists/)
})

test("new CLI --type research-paper scaffolds LaTeX", async () => {
  const parent = makeTempRepo({})
  const r = await runCli(["new", "my-paper", "--type", "research-paper", "--beginner", "--yes"], { cwd: parent })
  assert.strictEqual(r.code, 0)
  const projDir = join(parent, "my-paper")
  assert.ok(existsSync(join(projDir, "main.tex")))
  assert.ok(existsSync(join(projDir, "Makefile")))
  assert.ok(existsSync(join(projDir, "armada/armada.yaml")))
})

test("new CLI --type ml-training scaffolds Python project", async () => {
  const parent = makeTempRepo({})
  const r = await runCli(["new", "my-ml", "--type", "ml-training", "--beginner", "--yes"], { cwd: parent })
  assert.strictEqual(r.code, 0)
  const projDir = join(parent, "my-ml")
  assert.ok(existsSync(join(projDir, "pyproject.toml")))
  assert.ok(existsSync(join(projDir, "src/train.py")))
  assert.ok(existsSync(join(projDir, "armada/armada.yaml")))
})

test("new CLI placeholder substitution", async () => {
  const parent = makeTempRepo({})
  const r = await runCli(["new", "CoolProject", "--type", "web-app", "--beginner", "--yes"], { cwd: parent })
  assert.strictEqual(r.code, 0)
  const projDir = join(parent, "CoolProject")
  const pkg = JSON.parse(readFileSync(join(projDir, "package.json"), "utf8"))
  assert.strictEqual(pkg.name, "coolproject")
  const layout = readFileSync(join(projDir, "src/app/layout.tsx"), "utf8")
  assert.match(layout, /CoolProject/)
  const readme = readFileSync(join(projDir, "README.md"), "utf8")
  assert.match(readme, /CoolProject/)
  assert.doesNotMatch(layout, /\{project_\w+\}/)
  assert.doesNotMatch(readme, /\{\w+\}/)
})
