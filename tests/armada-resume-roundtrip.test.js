/**
 * Phase 3 — E2E: armada-resume command round-trip stability.
 *
 * Proves that re-scaffolding a repo (scaffold() twice from the same manifest)
 * keeps .opencode/commands/armada-resume.md byte-identical, and that the
 * rendered file contains the new global `armada reconcile` primary path.
 */

import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { scaffold } from "../src/scaffold.js"
import { ROLES, modelFor } from "../src/model-catalog.js"

function makeManifest(dir) {
  return {
    targetDir: dir,
    project: {
      name: "resume-roundtrip",
      budget: "balanced",
      browserTesting: false,
      devcontainer: false,
      useAgentBrowser: false,
      headless: false,
      yolo: false,
      requirementsFile: "armada/REQUIREMENTS.md",
      supervision: { plugin: false },
      stack: {},
    },
    team: ROLES.map((r) => ({
      role: r,
      model: modelFor(r, "balanced"),
      fallback: null,
      enabled: true,
    })),
  }
}

test("armada-resume: render contains armada reconcile and node src/cli.js reconcile", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-resume-rr-"))
  try {
    scaffold(makeManifest(dir), {})
    const file = join(dir, ".opencode/commands/armada-resume.md")
    const content = readFileSync(file, "utf8")

    assert.ok(content.length > 0, "armada-resume.md is non-empty")
    assert.ok(content.startsWith("---"), "armada-resume.md starts with YAML frontmatter (---)")
    assert.ok(content.includes("armada reconcile"), "contains global 'armada reconcile' primary path")
    assert.ok(content.includes("node src/cli.js reconcile"), "contains fallback 'node src/cli.js reconcile'")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("armada-resume: second scaffold produces byte-identical file", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-resume-rr-"))
  try {
    const manifest = makeManifest(dir)

    // First scaffold
    scaffold(manifest, {})
    const file = join(dir, ".opencode/commands/armada-resume.md")
    const first = readFileSync(file, "utf8")
    const firstLines = first.split("\n").length

    // Second scaffold (round-trip)
    scaffold(manifest, {})
    const second = readFileSync(file, "utf8")
    const secondLines = second.split("\n").length

    assert.strictEqual(first, second, "armada-resume.md must be byte-identical after second scaffold")
    assert.strictEqual(firstLines, secondLines, "line count must match between first and second render")

    // Re-assert content requirements on the round-tripped file
    assert.ok(second.includes("armada reconcile"), "round-tripped file still contains 'armada reconcile'")
    assert.ok(second.includes("node src/cli.js reconcile"), "round-tripped file still contains 'node src/cli.js reconcile'")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
