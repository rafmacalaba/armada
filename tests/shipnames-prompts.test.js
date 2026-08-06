import { test } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prompt = (role) => readFileSync(
  path.join(__dirname, "..", "agents", role, "prompt.template.md"), "utf8"
)

// Roles that call the `task` tool must carry the full rule.
const DISPATCHING = ["orchestrator", "backend-dev", "frontend-dev", "qa", "docs"]

// Read-only roles never dispatch subagents; a one-liner suffices.
const READ_ONLY = ["adversary", "security", "architect"]

const ALL = [...DISPATCHING, ...READ_ONLY]

test("every dispatching prompt carries the full shipnames rule", () => {
  for (const role of DISPATCHING) {
    const body = prompt(role)
    assert.ok(body.includes("work-only"), `${role} must set description to the work-only title`)
    assert.ok(body.includes("auto-prefixes"), `${role} must mention the plugin auto-prefix`)
  }
})

test("every read-only prompt carries the shipnames one-liner", () => {
  for (const role of READ_ONLY) {
    const body = prompt(role)
    assert.ok(
      body.includes("You do not dispatch subagents"),
      `${role} must state it does not dispatch subagents`
    )
  }
})

test("all 8 prompts carry the Shipnames title format header", () => {
  for (const role of ALL) {
    const body = prompt(role)
    assert.ok(
      body.includes("## Shipnames title format"),
      `${role} must include the Shipnames title format header`
    )
  }
})