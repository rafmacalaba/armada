import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

// Lightweight regression guard: the orchestrator (commodore) is allowed to
// write the voyage contract at `<worktree>/armada/REQUIREMENTS.md`. This test
// simulates the voyage worktree with a temp dir and proves the file pattern
// is writable + readable. It does NOT exercise the real voyage flow or the
// real permission system — that's enforced by the harness tool layer. This
// is just a smoke test for the contract file path + format.
test("orchestrator can write a contract in a voyage worktree", () => {
  const wtRoot = mkdtempSync(join(tmpdir(), "voyage-contract-smoke-"))
  const contractDir = join(wtRoot, "armada")
  const contractPath = join(contractDir, "REQUIREMENTS.md")

  try {
    mkdirSync(contractDir, { recursive: true })
    writeFileSync(
      contractPath,
      "# voyage-contract-smoke\n\n## Phase 1\n\n- [ ] test passes\n",
      "utf8"
    )

    assert.ok(existsSync(contractPath), "contract file exists")
    const content = readFileSync(contractPath, "utf8")
    assert.match(content, /^# voyage-contract-smoke/)
    assert.match(content, /## Phase 1/)
  } finally {
    rmSync(wtRoot, { recursive: true, force: true })
  }
})
