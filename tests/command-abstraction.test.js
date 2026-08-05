import { test } from "node:test"
import assert from "node:assert/strict"
import {
  renderArmadaCommand,
  renderArmadaScoutCommand,
  renderArmadaResumeCommand,
  renderArmadaVoyageCommand,
} from "../src/generator.js"

const RENDERERS = [
  ["renderArmadaCommand", renderArmadaCommand],
  ["renderArmadaScoutCommand", renderArmadaScoutCommand],
  ["renderArmadaResumeCommand", renderArmadaResumeCommand],
  ["renderArmadaVoyageCommand", renderArmadaVoyageCommand],
]

for (const [name, fn] of RENDERERS) {
  test(`${name} frontmatter includes subtask: true`, () => {
    const md = fn()
    const fm = md.match(/^---\n([\s\S]*?)\n---/m)
    assert.ok(fm, `frontmatter not found in ${name}`)
    assert.match(fm[1], /subtask:\s*true/, `${name} frontmatter must include "subtask: true"`)
  })
}

test("armada command frontmatter has description but no agent line", () => {
  const fm = renderArmadaCommand().match(/^---\n([\s\S]*?)\n---/m)[1]
  assert.match(fm, /description:/, "armada.md must have description")
  assert.doesNotMatch(fm, /agent:/, "armada.md must not have agent: (it's a primary-mode helper)")
})

test("agent-bearing commands have agent: commodore (or orchestrator) in frontmatter", () => {
  const agents = [
    renderArmadaScoutCommand,
    renderArmadaResumeCommand,
    renderArmadaVoyageCommand,
  ]
  for (const fn of agents) {
    const fm = fn().match(/^---\n([\s\S]*?)\n---/m)[1]
    assert.match(fm, /agent:\s+\w+/, `${fn.name} frontmatter must include an agent`)
  }
})

test("all command frontmatters are self-contained (body text not in frontmatter)", () => {
  for (const [name, fn] of RENDERERS) {
    const md = fn()
    const fmMatch = md.match(/^---\n([\s\S]*?)\n---\n/)
    assert.ok(fmMatch, `frontmatter not found in ${name}`)
    const fm = fmMatch[1]
    // Frontmatter must only contain recognized YAML keys (description, subtask, agent)
    const lines = fm.split("\n").filter((l) => l.trim())
    for (const line of lines) {
      assert.match(line, /^(description|subtask|agent):/, `${name} frontmatter has unknown key: "${line}"`)
    }
  }
})

test("description in each frontmatter is non-empty", () => {
  for (const [name, fn] of RENDERERS) {
    const md = fn()
    const fm = md.match(/^---\n([\s\S]*?)\n---/m)[1]
    assert.match(fm, /description:\s*\S/, `${name} frontmatter must have non-empty description`)
  }
})
