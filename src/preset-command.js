// Preset command: parse and apply budget presets to an existing armada.yaml.
import YAML from "yaml"
import { readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { parseManifestYaml } from "./manifest.js"
import { ROLES, BUDGETS } from "./model-catalog.js"
import { renderManifestYaml, buildTeam } from "./generator.js"

export function parsePresetYaml(text) {
  let raw
  try {
    raw = YAML.parse(text)
  } catch (err) {
    throw new Error(`Invalid preset YAML: ${err.message}`)
  }

  if (!raw || typeof raw !== "object") {
    throw new Error("Preset must be a YAML object")
  }

  if (!raw.budget || !BUDGETS.includes(raw.budget)) {
    throw new Error(
      `Preset budget must be one of free, balanced, power, got: ${JSON.stringify(raw.budget)}`
    )
  }

  if (!raw.agents || typeof raw.agents !== "object" || Array.isArray(raw.agents)) {
    throw new Error("Preset must have an 'agents' object")
  }

  const parsed = { budget: raw.budget, agents: {} }

  for (const [role, entry] of Object.entries(raw.agents)) {
    if (!ROLES.includes(role)) {
      throw new Error(`Unknown role in preset agents: ${role}`)
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Preset agent entry for ${role} must be an object`)
    }
    if (typeof entry.model !== "string" || entry.model === "") {
      throw new Error(`Preset agent ${role}.model must be a non-empty string`)
    }
    if (entry.variant !== undefined && entry.variant !== null && typeof entry.variant !== "string") {
      throw new Error(`Preset agent ${role}.variant must be a string`)
    }

    parsed.agents[role] = { model: entry.model }
    if (entry.variant !== undefined) {
      parsed.agents[role].variant = entry.variant
    }
  }

  return parsed
}

function resolvePresetsDir() {
  const moduleDir = dirname(fileURLToPath(import.meta.url))
  return join(moduleDir, "..", "presets")
}

export function applyPreset(targetDir, name, opts = {}) {
  // 1. Read armada.yaml
  const manifestPath = join(targetDir, "armada", "armada.yaml")
  let text
  try {
    text = readFileSync(manifestPath, "utf8")
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(`armada.yaml not found at ${manifestPath}`)
    }
    throw err
  }

  // 2. Parse + validate
  const manifest = parseManifestYaml(text)

  // 3. Read and parse preset
  const presetsDir = opts.presetsDir || resolvePresetsDir()
  const presetPath = join(presetsDir, `${name}.yaml`)
  let presetText
  try {
    presetText = readFileSync(presetPath, "utf8")
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(`Unknown preset: ${name}`)
    }
    throw err
  }
  const preset = parsePresetYaml(presetText)

  // 4. Apply budget + per-role model/variant
  manifest.project.budget = preset.budget
  let changed = 0
  for (const entry of manifest.team) {
    const rolePreset = preset.agents[entry.role]
    if (!rolePreset) continue
    if (entry.model !== rolePreset.model) {
      entry.model = rolePreset.model
      changed++
    }
    if (rolePreset.variant !== undefined) {
      entry.variant = rolePreset.variant
    }
  }

  // 5. Render through the generator (single source of truth) and write back
  const newYaml = renderManifestYaml(manifest, buildTeam(manifest))
  writeFileSync(manifestPath, newYaml, "utf8")

  // 6. Re-parse for return value
  return { changed, budget: preset.budget, manifest: parseManifestYaml(newYaml) }
}
