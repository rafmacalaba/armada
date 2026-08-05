import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { readFileSync } from "node:fs"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { formatHandoffBlock } from "../src/handoff.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

test("formatHandoffBlock: single session", () => {
  const result = formatHandoffBlock(["foo"])
  const expected = `--- HANDOFF ---
Voyages dispatched this turn:
  - foo  (tmux session: foo)  attach: armada voyage attach foo
Current window: free \u2014 hand off here.
--- END HANDOFF ---`
  assert.equal(result, expected)
})

test("formatHandoffBlock: multiple sessions", () => {
  const result = formatHandoffBlock(["foo", "bar", "baz"])
  const expected = `--- HANDOFF ---
Voyages dispatched this turn:
  - foo  (tmux session: foo)  attach: armada voyage attach foo
  - bar  (tmux session: bar)  attach: armada voyage attach bar
  - baz  (tmux session: baz)  attach: armada voyage attach baz
Current window: free \u2014 hand off here.
--- END HANDOFF ---`
  assert.equal(result, expected)
})

test("formatHandoffBlock: zero sessions returns empty string", () => {
  const result = formatHandoffBlock([])
  assert.equal(result, "")
})

test("armada voyage attach <name>: prints tmux attach command, exit 0", () => {
  const cli = join(process.cwd(), "src", "cli.js")
  const result = spawnSync(process.execPath, [cli, "voyage", "attach", "foo"], { encoding: "utf8" })
  assert.equal(result.status, 0, `exit ${result.status}: ${result.stderr}`)
  assert.equal(result.stdout.trim(), "tmux attach -t 'foo'")
})

test("armada voyage attach (no name): prints usage to stderr, exit 1", () => {
  const cli = join(process.cwd(), "src", "cli.js")
  const result = spawnSync(process.execPath, [cli, "voyage", "attach"], { encoding: "utf8" })
  assert.equal(result.status, 1, `exit ${result.status}`)
  assert.ok(result.stderr.includes("Usage:"), `expected usage on stderr, got: ${result.stderr}`)
})

test("armada help: voyage-handoff line has 2-space indent", () => {
  const cli = join(process.cwd(), "src", "cli.js")
  const result = spawnSync(process.execPath, [cli, "help"], { encoding: "utf8" })
  assert.equal(result.status, 0, `help failed: ${result.stderr}`)
  const expected = "  armada voyage-handoff <name> [<name>...]  print handoff block for dispatched voyages"
  const found = result.stdout.split("\n").find(line => line.includes("voyage-handoff"))
  assert.equal(found, expected, `expected "${expected}", got "${found}"`)
})

// Voyage completion template tests
function readTemplate() {
  return readFileSync(join(__dirname, "..", "agents", "orchestrator", "prompt.template.md"), "utf8")
}

test("orchestrator template has Voyage completion section", () => {
  const template = readTemplate()
  assert.ok(template.includes("## Voyage completion"), "template must contain ## Voyage completion section")
})

test("Voyage completion section contains TODO.md rule", () => {
  const template = readTemplate()
  const sectionStart = template.indexOf("## Voyage completion")
  assert.ok(sectionStart >= 0, "Voyage completion section must exist")
  const nextSection = template.indexOf("\n## ", sectionStart + 1)
  const section = nextSection >= 0 ? template.slice(sectionStart, nextSection) : template.slice(sectionStart)
  assert.ok(section.includes("TODO.md"), "Voyage completion section must reference TODO.md")
})

test("Voyage completion section contains gh pr view rule", () => {
  const template = readTemplate()
  const sectionStart = template.indexOf("## Voyage completion")
  assert.ok(sectionStart >= 0, "Voyage completion section must exist")
  const nextSection = template.indexOf("\n## ", sectionStart + 1)
  const section = nextSection >= 0 ? template.slice(sectionStart, nextSection) : template.slice(sectionStart)
  assert.ok(section.includes("gh pr view"), "Voyage completion section must reference gh pr view")
})

test("Voyage completion section contains git fetch origin rule", () => {
  const template = readTemplate()
  const sectionStart = template.indexOf("## Voyage completion")
  assert.ok(sectionStart >= 0, "Voyage completion section must exist")
  const nextSection = template.indexOf("\n## ", sectionStart + 1)
  const section = nextSection >= 0 ? template.slice(sectionStart, nextSection) : template.slice(sectionStart)
  assert.ok(section.includes("git fetch origin"), "Voyage completion section must reference git fetch origin")
})
