import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

// Phase 2 grep: the armed-repo upgrade path lives in the "using armada" doc.
const DOC_FILE = "docs/using-armada.md"

test("Phase 2 grep: using-armada doc carries the armed-repo upgrade path", () => {
  const doc = readFileSync(join(ROOT, DOC_FILE), "utf8")

  // Both steps must be in the same document: global install + re-scaffold flag.
  const installStep = "npm install -g opencode-armada"
  const fromArmadaFlag = "--from-armada"
  assert.ok(
    doc.includes(installStep),
    `${DOC_FILE} must mention "${installStep}" in the upgrade section`
  )
  assert.ok(
    doc.includes(fromArmadaFlag),
    `${DOC_FILE} must mention "${fromArmadaFlag}" in the upgrade section`
  )

  // The section is present and framed as an upgrade, not plain regeneration.
  assert.ok(
    /^## Upgrading an armed repo$/m.test(doc),
    `${DOC_FILE} must carry a "## Upgrading an armed repo" section`
  )
  assert.ok(
    doc.includes("upgrade in two steps"),
    `${DOC_FILE} upgrade section must carry the two-step framing`
  )
})
