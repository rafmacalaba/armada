import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { scaffold } from "../src/scaffold.js"
import { ROLES, modelFor } from "../src/model-catalog.js"

const OUR_CLAUDE = join(process.cwd(), "CLAUDE.md")

test("dogfood: scaffold over this repo's instruction files preserves them", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-dogfood-"))
  writeFileSync(join(dir, "CLAUDE.md"), readFileSync(OUR_CLAUDE, "utf8"))
  writeFileSync(join(dir, "opencode.json"), "{\"custom\":true}\n")
  const m = {
    targetDir: dir,
    project: { name: "armada", budget: "balanced", browserTesting: false, devcontainer: false,
      useAgentBrowser: false, stack: {} },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "balanced"), fallback: null, enabled: true })),
  }
  scaffold(m, {})
  assert.strictEqual(readFileSync(join(dir, "CLAUDE.md"), "utf8"), readFileSync(OUR_CLAUDE, "utf8"))
  assert.strictEqual(JSON.parse(readFileSync(join(dir, "opencode.json"), "utf8")).custom, true)
})
