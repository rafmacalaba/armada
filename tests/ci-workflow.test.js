import { test } from "node:test"
import assert from "node:assert"
import { readFileSync, readdirSync } from "node:fs"
import { join, extname } from "node:path"
import YAML from "yaml"

// DEF-004: CI actions must be pinned to commit SHAs, and every job must have explicit permissions.

const WORKFLOW_DIR = join(process.cwd(), ".github", "workflows")

// Collect all workflow files
const workflowFiles = (() => {
  try {
    return readdirSync(WORKFLOW_DIR).filter((f) => extname(f) === ".yml" || extname(f) === ".yaml")
  } catch {
    return []
  }
})()

// Collect all `uses:` references from a YAML document recursively
function collectUses(obj, uses = []) {
  if (!obj || typeof obj !== "object") return uses
  if (Array.isArray(obj)) {
    for (const item of obj) collectUses(item, uses)
  } else {
    if (obj.uses && typeof obj.uses === "string") uses.push(obj.uses)
    for (const val of Object.values(obj)) collectUses(val, uses)
  }
  return uses
}

// Collect all jobs from a workflow
function collectJobs(workflow) {
  if (!workflow || typeof workflow !== "object") return {}
  return workflow.jobs || {}
}

// Check if a `uses:` value is a commit SHA (40 hex chars at end)
function isPinned(ref) {
  // ref like "actions/checkout@v4" -> not pinned
  // ref like "actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683" -> pinned
  const parts = ref.split("@")
  if (parts.length < 2) return false
  const version = parts[parts.length - 1]
  return /^[a-f0-9]{40}$/.test(version)
}

for (const wf of workflowFiles) {
  const wfPath = join(WORKFLOW_DIR, wf)
  const content = readFileSync(wfPath, "utf8")
  let workflow
  try {
    workflow = YAML.parse(content)
  } catch {
    // Skip unparseable YAML
    continue
  }

  test(`workflow ${wf}: every uses: is pinned to SHA`, () => {
    const uses = collectUses(workflow)
    const unpinned = uses.filter((u) => !isPinned(u))
    assert.deepStrictEqual(unpinned, [], `unpinned actions in ${wf}: ${JSON.stringify(unpinned)}`)
  })

  test(`workflow ${wf}: every job has permissions`, () => {
    const jobs = collectJobs(workflow)
    const jobNames = Object.keys(jobs)
    if (jobNames.length === 0) return // no jobs, skip
    for (const jobName of jobNames) {
      const job = jobs[jobName]
      // Check if job has a `permissions:` key
      assert.ok(
        job.permissions !== undefined,
        `job "${jobName}" in ${wf} missing permissions block`
      )
    }
  })
}
