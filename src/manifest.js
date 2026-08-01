// armada.yaml manifest — single source of truth for a generated team.
//
// `armada init` writes this into a repo. Re-running `armada init --from-armada`
// regenerates the exact same config. It is versioned with the project.

export const MANIFEST_SCHEMA = {
  project: {
    name: "string",
    stack: "object", // from stack-detect
    budget: "free|balanced|power",
    browserTesting: "boolean",
    devcontainer: "boolean",
    useAgentBrowser: "boolean",
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
