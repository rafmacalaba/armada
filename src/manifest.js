// armada.yaml manifest — single source of truth for a generated team.
//
// `armada init` writes this into a repo. Re-running `armada init --from-armada`
// regenerates the exact same config. It is versioned with the project.

import YAML from "yaml"
import { isAbsolute, resolve, sep } from "node:path"
import { ROLES } from "./model-catalog.js"

const BUDGETS = new Set(["free", "balanced", "power"])

export function validateRequirementsFile(file, target) {
  if (typeof file !== "string") throw new Error("requirementsFile must be a string")
  if (file === "") throw new Error("requirementsFile must be non-empty")
  if (file.split(/[\/\\]/).includes("..")) throw new Error(`requirementsFile "${file}" must not contain '..'`)
  if (isAbsolute(file)) throw new Error(`requirementsFile "${file}" must be a relative path`)
  if (target !== undefined) {
    const absFile = resolve(target, file)
    const absTarget = resolve(target)
    if (absFile !== absTarget && !absFile.startsWith(absTarget + sep)) {
      throw new Error(`requirementsFile "${file}" must be inside the target directory`)
    }
  }
}

const VALID_PERMISSION_VALUES = new Set(["allow", "deny", "ask"])

function validatePermissionsDeep(obj, role, path) {
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = [...path, key]
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      validatePermissionsDeep(value, role, currentPath)
    } else if (typeof value === "string") {
      if (!VALID_PERMISSION_VALUES.has(value)) {
        throw new Error(
          `armada.yaml: schema violation: ${role} permissions.${currentPath.join(".")} must be "allow", "deny", or "ask"`
        )
      }
    } else {
      throw new Error(
        `armada.yaml: schema violation: ${role} permissions.${currentPath.join(".")} must be a string ("allow", "deny", or "ask")`
      )
    }
  }
}

function validatePermissions(perms, role) {
  if (perms === null || perms === undefined) return null
  if (typeof perms !== "object" || Array.isArray(perms)) {
    throw new Error(`armada.yaml: schema violation: ${role} permissions must be an object`)
  }
  validatePermissionsDeep(perms, role, [])
  return perms
}

function validateInstructions(instructions, role) {
  if (instructions === null || instructions === undefined) return null
  if (typeof instructions !== "string" || instructions === "") {
    throw new Error(`armada.yaml: schema violation: ${role} instructions must be a non-empty string`)
  }
  return instructions
}

function validatePrompt(prompt, role, target) {
  if (prompt === null || prompt === undefined) return null
  if (typeof prompt !== "string" || prompt === "") {
    throw new Error(`armada.yaml: schema violation: ${role} prompt must be a non-empty string`)
  }
  if (prompt.split(/[\/\\]/).includes("..")) {
    throw new Error(`armada.yaml: schema violation: ${role} prompt must not contain '..'`)
  }
  if (isAbsolute(prompt)) {
    throw new Error(`armada.yaml: schema violation: ${role} prompt must be a relative path`)
  }
  if (target !== undefined) {
    const absFile = resolve(target, prompt)
    const absTarget = resolve(target)
    if (absFile !== absTarget && !absFile.startsWith(absTarget + sep)) {
      throw new Error(`armada.yaml: schema violation: ${role} prompt must be inside the target directory`)
    }
  }
  return prompt
}

function parseBoolean(value, field) {
  if (value === true || value === "true") return true
  if (value === false || value === "false") return false
  throw new Error(`armada.yaml: schema violation: ${field} must be a boolean`)
}

function validateSkills(skills) {
  if (skills === undefined || skills === null) return undefined
  if (!Array.isArray(skills)) {
    throw new Error("armada.yaml: schema violation: project.skills must be a list")
  }
  for (const s of skills) {
    if (typeof s !== "string") {
      throw new Error("armada.yaml: schema violation: project.skills entries must be strings")
    }
  }
  return skills
}

export function parseManifestYaml(text, target) {
  let raw
  try {
    raw = YAML.parse(text)
  } catch (err) {
    throw new Error(`armada.yaml: invalid YAML (${err.message})`)
  }
  if (!raw || typeof raw !== "object") throw new Error("armada.yaml: schema violation: root must be an object")
  if (!raw.project || typeof raw.project !== "object") throw new Error("armada.yaml: missing 'project' section")
  if (!Array.isArray(raw.team)) throw new Error("armada.yaml: team must be a list")
  const p = raw.project
  if (typeof p.name !== "string") throw new Error("armada.yaml: schema violation: project.name must be a string")
  if (p.budget !== undefined && !BUDGETS.has(p.budget)) throw new Error("armada.yaml: schema violation: project.budget must be one of free, balanced, power")
  if (p.stack !== undefined && (typeof p.stack !== "object" || Array.isArray(p.stack))) throw new Error("armada.yaml: schema violation: project.stack must be an object")
  const boolFields = ["browserTesting", "devcontainer", "useAgentBrowser", "headless", "yolo"]
  for (const f of boolFields) {
    if (p[f] !== undefined && typeof p[f] !== "boolean") throw new Error(`armada.yaml: schema violation: project.${f} must be a boolean`)
  }
  if (p.supervision !== undefined && (typeof p.supervision !== "object" || Array.isArray(p.supervision))) {
    throw new Error("armada.yaml: schema violation: project.supervision must be an object")
  }
  if (p.supervision?.plugin !== undefined && typeof p.supervision.plugin !== "boolean") {
    throw new Error("armada.yaml: schema violation: project.supervision.plugin must be a boolean")
  }
  if (p.supervision?.fleet !== undefined && typeof p.supervision.fleet !== "boolean") {
    throw new Error("armada.yaml: schema violation: project.supervision.fleet must be a boolean")
  }
  if (p.supervision?.watchdog !== undefined && typeof p.supervision.watchdog !== "boolean") {
    throw new Error("armada.yaml: schema violation: project.supervision.watchdog must be a boolean")
  }
  if (p.supervision?.shipnames !== undefined && typeof p.supervision.shipnames !== "boolean") {
    throw new Error("armada.yaml: schema violation: project.supervision.shipnames must be a boolean")
  }
  if (p.feature !== undefined) {
    if (typeof p.feature !== "string" || p.feature === "") {
      throw new Error("armada.yaml: schema violation: project.feature must be a non-empty string")
    }
    if (p.feature.split(/[\/\\]/).includes("..")) {
      throw new Error("armada.yaml: schema violation: project.feature must not contain '..'")
    }
    if (/[\/\\]/.test(p.feature)) {
      throw new Error("armada.yaml: schema violation: project.feature must not contain path separators")
    }
  }
  const stack = p.stack ?? {}
  const seenRoles = new Set()
  const team = raw.team.map((t) => {
    if (!t || typeof t !== "object") throw new Error("armada.yaml: schema violation: team entry must be an object")
    if (!ROLES.includes(t.role)) throw new Error(`armada.yaml: schema violation: unknown team role "${t.role}"`)
    if (seenRoles.has(t.role)) throw new Error(`armada.yaml: duplicate team role "${t.role}"`)
    seenRoles.add(t.role)
    if (typeof t.model !== "string" || t.model === "") throw new Error("armada.yaml: schema violation: team.model must be a non-empty string")
    if (t.fallback !== undefined && t.fallback !== null && typeof t.fallback !== "string") throw new Error("armada.yaml: schema violation: team.fallback must be a string or null")
    if (t.variant !== undefined && t.variant !== null && typeof t.variant !== "string") throw new Error("armada.yaml: schema violation: team.variant must be a string or null")
    return {
      role: t.role,
      model: t.model,
      fallback: t.fallback ?? null,
      variant: t.variant ?? null,
      enabled: parseBoolean(t.enabled, "team.enabled"),
      permissions: validatePermissions(t.permissions, t.role),
      instructions: validateInstructions(t.instructions, t.role),
      prompt: validatePrompt(t.prompt, t.role, target),
    }
  })
  if (!team.length) throw new Error("armada.yaml: team is empty")
  validateRequirementsFile(p.requirementsFile ?? "armada/REQUIREMENTS.md")
  const skills = validateSkills(p.skills)
  return {
    project: {
      name: p.name ?? "project",
      budget: p.budget ?? "balanced",
      browserTesting: p.browserTesting ?? false,
      devcontainer: p.devcontainer ?? false,
      useAgentBrowser: p.useAgentBrowser ?? false,
      headless: p.headless ?? false,
      yolo: p.yolo ?? false,
      requirementsFile: p.requirementsFile ?? "armada/REQUIREMENTS.md",
      feature: p.feature ?? null,
      skills,
      supervision: {
        plugin: p.supervision?.plugin ?? false,
        fleet: p.supervision?.fleet ?? true,
        watchdog: p.supervision?.watchdog ?? false,
        shipnames: p.supervision?.shipnames ?? true,
      },
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
    feature: "string", // optional: per-feature name for ledger paths
    stack: "object", // from stack-detect
    budget: "free|balanced|power",
    browserTesting: "boolean",
    devcontainer: "boolean",
    useAgentBrowser: "boolean",
    headless: "boolean", // non-interactive mode: orchestrator bash allow (CI-safe)
    yolo: "boolean", // autonomous mode: no permission prompts (config allow, boundaries kept)
    supervision: { plugin: "boolean", fleet: "boolean", watchdog: "boolean", shipnames: "boolean" }, // opt-in supervision plugins
    requirementsFile: "string", // per-feature contract (default armada/REQUIREMENTS.md)
  },
  team: "array<{name, role, model, fallback, variant?, enabled}>",
  presets: "object", // model presets generated from budget
  playbook: "object", // defect ledger, phase gates, ownership rules
}

export const DEFAULT_PLAYBOOK = {
  defectLedger: {
    file: "armada/ledgers/{feature}/DEFECTS.md",
    shared: "armada/ledgers/shared/DEFECTS.md",
    owner: "qa",
    statuses: ["OPEN", "FIX-READY", "DISPUTED", "CLOSED", "REJECTED"],
  },
  adversarialLedger: {
    file: "armada/ledgers/{feature}/ADVERSARIAL_REVIEW.md",
    shared: "armada/ledgers/shared/ADVERSARIAL_REVIEW.md",
    owner: "adversary",
  },
  securityLedger: {
    file: "armada/ledgers/{feature}/SECURITY_FINDINGS.md",
    shared: "armada/ledgers/shared/SECURITY_FINDINGS.md",
    owner: "security",
  },
  architectLedger: {
    file: "armada/ledgers/{feature}/ARCHITECT_REVIEW.md",
    shared: "armada/ledgers/shared/ARCHITECT_REVIEW.md",
    owner: "architect",
  },
  phases: {
    gateCriteria: "evidence: passing tests and/or screenshots",
    contract: "armada/REQUIREMENTS.md",
  },
  roleBoundaries: "enforced by agent permissions; do not bypass via shell",
  conventions: {
    noEmojisInCode: true,
    preferPopularLibraries: true,
    keepItSimple: true,
  },
}
