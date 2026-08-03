import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

// Phase 3 grep: the docs may never say "Lane A"/"Lane B" outside the glossary.
// Explicit file list — docs only. Never node_modules, never generated artifacts.
const DOC_FILES = [
  "README.md",
  "AGENTS.md",
  "SPEC.md",
  "ARCHITECTURE.md",
  "TODO.md",
  "docs/armada-improves-armada.md",
  "docs/sandbox.md",
  "docs/using-armada.md",
  "docs/validation.md",
  "docs/RELEASING.md",
]

const OLD_TERMS = ["Lane A", "Lane B"]

// A line may keep old terms only when it is the glossary/exemption line.
const EXEMPT_MARKERS = ["Glossary", "glossary", "Old terminology"]

test("Phase 3 grep: docs never say 'Lane A'/'Lane B' (glossary exemption only)", () => {
  for (const doc of DOC_FILES) {
    const file = join(ROOT, doc)
    const lines = readFileSync(file, "utf8").split("\n")
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const hit = OLD_TERMS.find((t) => line.includes(t))
      if (!hit) continue
      const exempt = EXEMPT_MARKERS.some((m) => line.includes(m))
      assert.ok(
        exempt,
        `${doc}:${i + 1} still says "${hit}": ${line.trim()}. Only a glossary/exemption line may keep old terms (use "patrol" / "voyage").`
      )
    }
  }
})

test("Phase 3 grep: README carries the old -> new glossary", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8")
  assert.ok(
    /^## Glossary: armada terminology$/m.test(readme),
    "README.md must carry a '## Glossary: armada terminology' section"
  )
  assert.ok(
    readme.includes("Old terminology"),
    "the glossary must carry the one-line old-terminology exemption"
  )
})
