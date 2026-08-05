import { test } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const template = readFileSync(join(__dirname, "..", "agents", "orchestrator", "prompt.template.md"), "utf8")

test("orchestrator prompt has dispatch narration rule", () => {
  // Rule must describe format: shipName from displayFor(role) followed by [role].
  assert.match(template, /displayFor\(role\).*\[.*role.*\]|\[.*role.*\].*displayFor\(role\)/,
    "prompt must describe dispatch narration using displayFor(role) and [role] brackets")

  // Rule must be a hard MUST.
  assert.match(template, /MUST state the ship name|MUST.*dispatch.*narration|dispatch.*narration.*MUST/i,
    "prompt must have hard MUST for dispatch narration")

  // Rule must cite src/role-display.js DISPLAY as the source.
  assert.match(template, /role-display\.js.*DISPLAY/,
    "prompt must cite src/role-display.js DISPLAY as ship-name source")
})
