import { test } from "node:test"
import assert from "node:assert"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

test("armada-improves-armada.md Finish section frames the PR as evidence", () => {
  const md = readFileSync(join(__dirname, "..", "docs", "armada-improves-armada.md"), "utf8")
  // Find the Finish section between the heading and the next ### or end.
  const finishMatch = md.match(/###\s+Finish[\s\S]*?(?=\n###\s|\n##\s|\Z)/)
  assert.ok(finishMatch, "docs must contain a '### Finish' section")
  const section = finishMatch[0]
  // The PR must be the success criterion, not local merge.
  assert.match(section, /pr\b/i, "Finish section must mention PR")
  assert.match(section, /merge locally|git merge/i, "Finish section must mention merge locally (forbidden)")
  assert.match(section, /evidence\s*=\s*pr url|pr url/i, "Finish section must frame PR URL as the evidence")
  // The Rule: sentence must still be present.
  assert.match(section, /^Rule:/m, "Finish section must contain a 'Rule:' line")
})
