import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { scaffold } from "../src/scaffold.js"
import { ROLES, modelFor } from "../src/model-catalog.js"

const OUR_AGENTS = join(process.cwd(), "AGENTS.md")

// Strip the armada marker section, if the repo itself is scaffolded (e.g. a
// sandbox worktree), so the copy simulates a pristine user instruction file.
function stripArmadaSection(text) {
  const start = text.indexOf("<!-- armada:start -->")
  const end = text.indexOf("<!-- armada:end -->")
  if (start === -1 || end === -1) return text
  return text.slice(0, start) + text.slice(end + "<!-- armada:end -->".length)
}

test("dogfood: scaffold over this repo's instruction files preserves user content", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-dogfood-"))
  const userRules = stripArmadaSection(readFileSync(OUR_AGENTS, "utf8"))
  writeFileSync(join(dir, "AGENTS.md"), userRules)
  writeFileSync(join(dir, "opencode.json"), "{\"custom\":true}\n")
  const m = {
    targetDir: dir,
    project: { name: "armada", budget: "balanced", browserTesting: false, devcontainer: false,
      useAgentBrowser: false, stack: {} },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "balanced"), fallback: null, enabled: true })),
  }
  scaffold(m, {})
  const agents = readFileSync(join(dir, "AGENTS.md"), "utf8")
  assert.ok(agents.startsWith(userRules), "user rules preserved")
  assert.match(agents, /<!-- armada:start -->/)
  assert.strictEqual(JSON.parse(readFileSync(join(dir, "opencode.json"), "utf8")).custom, true)
})
