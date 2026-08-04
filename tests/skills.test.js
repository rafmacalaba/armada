import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { skillRegistry } from "../src/skills/index.js"
import { renderSkillFile } from "../src/generator.js"
import { writeSkills, scaffold } from "../src/scaffold.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../src/generator.js"
import { parseManifestYaml } from "../src/manifest.js"

const SKILL_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

test("skill registry exists and has expected entries", () => {
  assert.ok(Array.isArray(skillRegistry), "skillRegistry must be an array")
  assert.ok(skillRegistry.length >= 2, "at least 2 skills expected")
})

test("every skill name matches ^[a-z0-9]+(-[a-z0-9]+)*$", () => {
  for (const skill of skillRegistry) {
    assert.match(skill.name, SKILL_NAME_RE, `skill name "${skill.name}" must match ${SKILL_NAME_RE}`)
  }
})

test("every skill has a non-empty description", () => {
  for (const skill of skillRegistry) {
    assert.ok(typeof skill.description === "string" && skill.description.length > 0,
      `skill "${skill.name}" missing description`)
  }
})

test("every skill has a non-empty body", () => {
  for (const skill of skillRegistry) {
    assert.ok(typeof skill.body === "string" && skill.body.length > 0,
      `skill "${skill.name}" missing body`)
  }
})

test("renderSkillFile produces .opencode/skills/<name>/SKILL.md with valid frontmatter", () => {
  for (const skill of skillRegistry) {
    const rendered = renderSkillFile(skill)
    assert.ok(rendered.startsWith("---\n"), "must start with YAML frontmatter")
    assert.ok(rendered.includes("name: " + skill.name), "frontmatter must contain name")
    assert.ok(rendered.includes("description:"), "frontmatter must contain description")
  }
})

test("renderSkillFile output has no dangling {placeholder} tokens", () => {
  for (const skill of skillRegistry) {
    const rendered = renderSkillFile(skill)
    const dangling = /\{[a-z_]+\}/.test(rendered)
    assert.ok(!dangling, `skill "${skill.name}" has dangling placeholder`)
  }
})

test("writeSkills writes files into .opencode/skills/<name>/SKILL.md", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-skills-"))
  try {
    writeSkills(dir, skillRegistry)
    for (const skill of skillRegistry) {
      const filePath = join(dir, ".opencode", "skills", skill.name, "SKILL.md")
      assert.ok(existsSync(filePath), `missing: ${filePath}`)
      const content = readFileSync(filePath, "utf8")
      assert.ok(content.startsWith("---\n"), `no frontmatter in ${skill.name}`)
      assert.ok(content.includes("name: " + skill.name), `wrong name in ${skill.name}`)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("writeSkills is idempotent (overwrites on second call)", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-skills-"))
  try {
    writeSkills(dir, skillRegistry)
    // Second call should not throw
    writeSkills(dir, skillRegistry)
    for (const skill of skillRegistry) {
      const filePath = join(dir, ".opencode", "skills", skill.name, "SKILL.md")
      assert.ok(existsSync(filePath), `missing after re-write: ${filePath}`)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// -- Phase 2: manifest skills control scaffold behavior --

function makeBaseManifest(dir) {
  return {
    targetDir: dir,
    project: {
      name: "t", budget: "balanced", browserTesting: false,
      devcontainer: false, useAgentBrowser: false, headless: false, yolo: false,
      requirementsFile: "armada/REQUIREMENTS.md",
      stack: { frontend: null, backend: null, database: null, testing: null, srcDirs: [], languages: [], instructions: [] },
    },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "balanced"), fallback: null, enabled: true })),
  }
}

test("scaffold with no skills field writes all starter skills", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-skills-"))
  try {
    const m = makeBaseManifest(dir)
    // No skills field set
    scaffold(m, m.project.stack, { gitignore: false })
    for (const skill of skillRegistry) {
      const p = join(dir, ".opencode", "skills", skill.name, "SKILL.md")
      assert.ok(existsSync(p), `missing: ${skill.name}`)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("scaffold with empty skills list writes no skill files", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-skills-"))
  try {
    const m = makeBaseManifest(dir)
    m.project.skills = []
    scaffold(m, m.project.stack, { gitignore: false })
    for (const skill of skillRegistry) {
      const p = join(dir, ".opencode", "skills", skill.name, "SKILL.md")
      assert.ok(!existsSync(p), `should be absent: ${skill.name}`)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("scaffold with custom skills list writes only those", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-skills-"))
  try {
    const m = makeBaseManifest(dir)
    m.project.skills = ["armada-contract"]
    scaffold(m, m.project.stack, { gitignore: false })
    const p1 = join(dir, ".opencode", "skills", "armada-contract", "SKILL.md")
    assert.ok(existsSync(p1), "armada-contract should be written")
    const p2 = join(dir, ".opencode", "skills", "armada-gate", "SKILL.md")
    assert.ok(!existsSync(p2), "armada-gate should be absent")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
