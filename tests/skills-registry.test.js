import { test } from "node:test"
import assert from "node:assert"

import { skillRegistry } from "../src/skills/index.js"

const EXPECTED_SKILLS = 9
const NON_EMOJI = /^[^\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}]*$/u

// Check if a string parses as valid YAML frontmatter (starts with ---, ends with ---,
// followed by optional body content). Returns parsed frontmatter object or null.
function parseFrontmatter(text) {
  if (typeof text !== "string") return null
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!match) return null
  // Lightweight YAML parse for flat keys: name, description
  const body = match[1]
  const result = {}
  const lines = body.split("\n")
  for (const line of lines) {
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.+)$/)
    if (kv) {
      result[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim()
    }
  }
  return result
}

test("skills registry has 9 entries", () => {
  assert.ok(Array.isArray(skillRegistry), "skillRegistry must be an array")
  assert.strictEqual(skillRegistry.length, EXPECTED_SKILLS,
    `expected ${EXPECTED_SKILLS} skills, got ${skillRegistry.length}`)
})

test("skill names are unique", () => {
  const names = skillRegistry.map((s) => s.name)
  const duplicate = names.filter((n, i) => names.indexOf(n) !== i)
  assert.deepStrictEqual(duplicate, [], `duplicate skill names: ${duplicate.join(", ")}`)
})

test("all skill names match ^[a-z0-9]+(-[a-z0-9]+)*$", () => {
  const namePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/
  for (const skill of skillRegistry) {
    assert.ok(
      namePattern.test(skill.name),
      `skill name "${skill.name}" does not match pattern`
    )
  }
})

test("all skills have a description <= 200 characters", () => {
  for (const skill of skillRegistry) {
    assert.ok(
      typeof skill.description === "string" && skill.description.length > 0,
      `skill "${skill.name}" has no description`
    )
    assert.ok(
      skill.description.length <= 200,
      `skill "${skill.name}" description is ${skill.description.length} chars (max 200)`
    )
  }
})

test("all skills have a non-empty body", () => {
  for (const skill of skillRegistry) {
    assert.ok(
      typeof skill.body === "string" && skill.body.trim().length > 0,
      `skill "${skill.name}" has no body`
    )
  }
})

test("no dangling {placeholder} in any skill body or description", () => {
  const placeholderPattern = /\{[a-zA-Z_][a-zA-Z0-9_]*\}/
  for (const skill of skillRegistry) {
    const bodyMatch = placeholderPattern.exec(skill.body)
    assert.strictEqual(bodyMatch, null,
      `skill "${skill.name}" body has dangling placeholder "${bodyMatch?.[0]}"`)
    const descMatch = placeholderPattern.exec(skill.description)
    assert.strictEqual(descMatch, null,
      `skill "${skill.name}" description has dangling placeholder "${descMatch?.[0]}"`)
  }
})

test("no emojis in any skill body or description", () => {
  for (const skill of skillRegistry) {
    assert.ok(NON_EMOJI.test(skill.body),
      `skill "${skill.name}" body contains an emoji`)
    assert.ok(NON_EMOJI.test(skill.description),
      `skill "${skill.name}" description contains an emoji`)
  }
})

test("all skill bodies render valid frontmatter with name and description", () => {
  for (const skill of skillRegistry) {
    const fm = parseFrontmatter(skill.body)
    assert.ok(fm !== null,
      `skill "${skill.name}" body has no frontmatter (--- ... ---)`)
    assert.ok(fm.name !== undefined && fm.name.length > 0,
      `skill "${skill.name}" frontmatter missing "name"`)
    assert.ok(fm.description !== undefined && fm.description.length > 0,
      `skill "${skill.name}" frontmatter missing "description"`)
    // Frontmatter name matches registry name
    assert.strictEqual(fm.name, skill.name,
      `skill "${skill.name}" frontmatter name "${fm.name}" does not match registry name`)
  }
})

test("skill body frontmatter name matches registry name", () => {
  // Already covered above, but keep as explicit check
  for (const skill of skillRegistry) {
    const fm = parseFrontmatter(skill.body)
    if (fm) {
      assert.strictEqual(fm.name, skill.name,
        `skill "${skill.name}": frontmatter name "${fm.name}" !== registry name`)
    }
  }
})

test("each SKILL.md file exists in src/skills/ and matches registry body", async () => {
  const { readFileSync, existsSync } = await import("node:fs")
  const { join } = await import("node:path")
  const { fileURLToPath } = await import("node:url")
  const { default: urlModule } = await import("node:url")
  const { dirname } = await import("node:path")

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const skillsDir = join(__dirname, "..", "src", "skills")

  for (const skill of skillRegistry) {
    const filePath = join(skillsDir, skill.name, "SKILL.md")
    assert.ok(existsSync(filePath),
      `missing SKILL.md for skill "${skill.name}" at ${filePath}`)
    const fileContent = readFileSync(filePath, "utf8")
    assert.strictEqual(fileContent, skill.body,
      `skill "${skill.name}" body in index.js does not match SKILL.md file content`)
  }
})

test("the 7 new skill names are present", () => {
  const required = [
    "armada-dispatch",
    "armada-pr",
    "armada-resume",
    "armada-ledger",
    "armada-context-budget",
    "armada-tdd",
    "armada-sdd",
  ]
  const registryNames = new Set(skillRegistry.map((s) => s.name))
  for (const name of required) {
    assert.ok(registryNames.has(name),
      `missing required skill "${name}" in registry`)
  }
})
