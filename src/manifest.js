// armada.yaml manifest — single source of truth for a generated team.
//
// `armada init` writes this into a repo. Re-running `armada init --from-armada`
// regenerates the exact same config. It is versioned with the project.

import YAML from "yaml"

export function parseManifestYaml(text) {
  let raw
  try {
    raw = YAML.parse(text)
  } catch (err) {
    throw new Error(`armada.yaml: invalid YAML (${err.message})`)
  }
  if (!raw || !raw.project) throw new Error("armada.yaml: missing 'project' section")
  if (!Array.isArray(raw.team)) throw new Error("armada.yaml: team must be a list")
  const p = raw.project
  const stack = p.stack ?? {}
  const team = raw.team.map((t) => ({
    role: t.role,
    model: t.model,
    fallback: t.fallback,
    enabled: t.enabled === false || t.enabled === "false" ? false : true,
  }))
  if (!team.length) throw new Error("armada.yaml: team is empty")
  return {
    project: {
      name: p.name ?? "project",
      budget: p.budget ?? "balanced",
      browserTesting: p.browserTesting ?? false,
      devcontainer: p.devcontainer ?? false,
      useAgentBrowser: p.useAgentBrowser ?? false,
      headless: p.headless ?? false,
      requirementsFile: p.requirementsFile ?? "REQUIREMENTS.md",
      stack: {
        frontend: stack.frontend ?? null,
        backend: stack.backend ?? null,
        database: stack.database ?? null,
        testing: stack.testing ?? null,
        srcDirs: stack.srcDirs ?? [],
        languages: stack.languages ?? [],
        instructions: stack.instructions ?? [],
      },
    },
    team,
    playbook: raw.playbook ?? {},
  }
}

export const MANIFEST_SCHEMA = {
  project: {
    name: "string",
    stack: "object", // from stack-detect
    budget: "free|balanced|power",
    browserTesting: "boolean",
    devcontainer: "boolean",
    useAgentBrowser: "boolean",
    headless: "boolean", // non-interactive mode: orchestrator bash allow (CI-safe)
    requirementsFile: "string", // per-feature contract (default REQUIREMENTS.md)
  },
  team: "array<{name, role, model, fallback, variant?, enabled}>",
  presets: "object", // model presets generated from budget
  playbook: "object", // defect ledger, phase gates, ownership rules
}

export const DEFAULT_PLAYBOOK = {
  defectLedger: {
    file: "DEFECTS.md",
    owner: "qa",
    statuses: ["OPEN", "FIX-READY", "DISPUTED", "CLOSED", "REJECTED"],
  },
  adversarialLedger: {
    file: "ADVERSARIAL_REVIEW.md",
    owner: "adversary",
  },
  phases: {
    gateCriteria: "evidence: passing tests and/or screenshots",
    contract: "REQUIREMENTS.md",
  },
  roleBoundaries: "enforced by agent permissions; do not bypass via shell",
  conventions: {
    noEmojisInCode: true,
    preferPopularLibraries: true,
    keepItSimple: true,
  },
}
