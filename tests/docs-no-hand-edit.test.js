import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

// Phase 4 grep: no doc may tell the user to hand-edit opencode.json to fix a
// drift. The documented fix is `armada update` (whitelist-only merge of the
// armada-owned keys: model, default_agent, permission, provider.openrouter.models).
// Explicit doc list — docs/ + README + SPEC. Never node_modules, never generated artifacts.
const DOC_FILES = [
  ...readdirSync(join(ROOT, "docs"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => `docs/${f}`),
  "README.md",
  "SPEC.md",
]

// Normalize a line: lowercase, strip backticks, collapse whitespace so that
// "edit `opencode.json`" and "edit opencode.json" match the same phrase.
function normalize(line) {
  return line.toLowerCase().replace(/`/g, "").replace(/\s+/g, " ").trim()
}

// Phrases that instruct the user to hand-edit opencode.json. Covers the
// mandated set plus the unambiguous hand-edit variants.
const FORBIDDEN_PHRASES = [
  "edit opencode.json",
  "editing opencode.json",
  "manually edit opencode.json",
  "manually editing opencode.json",
  "open opencode.json and",
  "hand-edit opencode.json",
  "hand edit opencode.json",
  "opencode.json by hand",
  "edit your opencode.json",
]

test("Phase 4 grep: no doc tells the user to hand-edit opencode.json", () => {
  for (const doc of DOC_FILES) {
    const file = join(ROOT, doc)
    const lines = readFileSync(file, "utf8").split("\n")
    for (let i = 0; i < lines.length; i++) {
      const normalized = normalize(lines[i])
      const hit = FORBIDDEN_PHRASES.find((p) => normalized.includes(p))
      assert.ok(
        !hit,
        `${doc}:${i + 1} tells the user to hand-edit opencode.json ("${hit}"): ${lines[i].trim()}. ` +
          "Drift in the armada-owned keys (default_agent, model, permission, provider.openrouter.models) " +
          "is fixed with `armada update`, never by hand-editing opencode.json."
      )
    }
  }
})

test("Phase 4 grep: the upgrade path is documented in using-armada and README", () => {
  const doc = readFileSync(join(ROOT, "docs/using-armada.md"), "utf8")
  const readme = readFileSync(join(ROOT, "README.md"), "utf8")

  // Positive case: `armada update` is referenced in both documents.
  assert.ok(doc.includes("armada update"), "docs/using-armada.md must document `armada update`")
  assert.ok(readme.includes("armada update"), "README.md must list `armada update` in the CLI table")

  // The upgrade section documents the two flags the feature ships.
  assert.ok(
    doc.includes("armada update --yes"),
    "docs/using-armada.md upgrade section must document `armada update --yes`"
  )
  assert.ok(
    doc.includes("--dry-run"),
    "docs/using-armada.md upgrade section must document `--dry-run`"
  )
  // The conservative re-scaffold escape hatch stays documented.
  assert.ok(
    doc.includes("armada init --from-armada armada/armada.yaml"),
    "docs/using-armada.md must keep `armada init --from-armada` as the conservative alternative"
  )
})
