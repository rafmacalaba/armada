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
