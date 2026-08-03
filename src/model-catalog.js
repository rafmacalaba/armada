// opencode-armada model catalog
//
// Curated, static model recommendations per role. Each role has:
//   - primary:    opencode / opencode-go / opencode-zen model (preferred provider)
//   - fallback:   openrouter model with equivalent capability (used when the
//                 opencode provider is unavailable, or as a /preset power bump)
//
// Budget tiers:
//   free      - only opencode *-free models and cheapest openrouter equivalents
//   balanced  - free workers, paid reviewers/judges where it matters (default)
//   power     - strongest models on every role
//
// Model names are opencode-style `provider/model` IDs. Keep this file in sync
// with docs/SPEC.md#model-catalog and presets/*.yaml.

import { execFile } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join, dirname, resolve, isAbsolute, sep } from "node:path"

import { displayFor } from "./role-display.js"

export const ROLES = [
  "orchestrator",
  "backend-dev",
  "frontend-dev",
  "qa",
  "adversary",
  "security",
  "docs",
  "architect",
]

export const CATALOG = {
  orchestrator: {
    label: "Delivery lead / scheduler",
    primary: "opencode-go/minimax-m3",
    variant: "thinking",
    fallback: "openrouter/z-ai/glm-5.2",
    free: "opencode-go/hy3",
    power: "openrouter/anthropic/claude-sonnet-4.6",
    reasoning: "strong judgment, delegation, reconciliation",
  },
  "backend-dev": {
    label: "Backend implementation",
    primary: "opencode-go/deepseek-v4-pro",
    fallback: "openrouter/deepseek/deepseek-v4-pro",
    free: "opencode/deepseek-v4-flash-free",
    power: "openrouter/z-ai/glm-5.2",
    reasoning: "server, API, storage, seed data, backend unit tests",
  },
  "frontend-dev": {
    label: "Frontend implementation",
    primary: "opencode-go/minimax-m3",
    fallback: "openrouter/minimax/minimax-m3",
    free: "opencode/mimo-v2.5-free",
    power: "openrouter/minimax/minimax-m3",
    reasoning: "UI/UX implementation, visual polish, frontend unit tests",
  },
  qa: {
    label: "Quality assurance",
    primary: "opencode/mimo-v2.5-free",
    fallback: "openrouter/xiaomi/mimo-v2.5",
    free: "opencode/mimo-v2.5-free",
    power: "openrouter/xiaomi/mimo-v2.5",
    reasoning: "e2e tests, screenshots, armada/ledgers/<feature>/DEFECTS.md ownership, retesting",
  },
  adversary: {
    label: "Adversarial reviewer",
    primary: "opencode-go/deepseek-v4-pro",
    fallback: "openrouter/deepseek/deepseek-v4-pro",
    free: "opencode/deepseek-v4-flash-free",
    power: "openrouter/deepseek/deepseek-v4-pro",
    reasoning: "hostile user simulation, break the running app, armada/ledgers/<feature>/ADVERSARIAL_REVIEW.md",
  },
  security: {
    label: "Security auditor",
    primary: "opencode/big-pickle",
    fallback: "openrouter/deepseek/deepseek-v4-pro",
    free: "opencode/big-pickle",
    power: "openrouter/deepseek/deepseek-v4-pro",
    reasoning: "vulnerability review, auth/authz, data exposure, dependency risk",
  },
  docs: {
    label: "Technical writer",
    primary: "opencode/deepseek-v4-flash-free",
    fallback: "openrouter/minimax/minimax-m3",
    free: "opencode/deepseek-v4-flash-free",
    power: "openrouter/minimax/minimax-m3",
    reasoning: "README, API docs, changelog, maintainable documentation",
  },
  architect: {
    label: "Architecture / code review",
    primary: "opencode/big-pickle",
    fallback: "openrouter/z-ai/glm-5.2",
    free: "opencode/big-pickle",
    power: "openrouter/z-ai/glm-5.2",
    reasoning: "architecture, refactor risk, cross-cutting design, review",
  },
}

export const BUDGETS = ["free", "balanced", "power"]

export function modelFor(role, budget = "balanced") {
  const entry = CATALOG[role]
  if (!entry) throw new Error(`Unknown role: ${role}`)
  if (budget === "power") return entry.power ?? entry.fallback
  if (budget === "free") return entry.free ?? entry.primary
  return entry.primary
}

export function fallbackFor(role) {
  return CATALOG[role].fallback
}

export function defaultCachePath() {
  return join(homedir(), ".armada", "models.cache.json")
}

// Keep `--cache <path>` from writing anywhere on the filesystem. Allowed: a relative
// filename (resolves under cwd) or an absolute path under ~/.armada. Rejects traversal,
// `~` expansion, and writes outside the cache area.
export function validateCachePath(cachePath) {
  const p = String(cachePath ?? "")
  if (p.startsWith("~")) throw new Error(`cache path must not use ~: ${p}`)
  if (p.split(/[\/\\]/).includes("..")) throw new Error(`cache path must not contain '..': ${p}`)
  if (isAbsolute(p)) {
    const root = resolve(homedir(), ".armada")
    const abs = resolve(p)
    if (abs !== root && !abs.startsWith(root + sep)) {
      throw new Error(`cache path must be inside ~/.armada: ${p}`)
    }
  }
}

export function loadModelsCache(cachePath = defaultCachePath()) {
  try {
    const c = JSON.parse(readFileSync(cachePath, "utf8"))
    return Array.isArray(c.models) ? new Set(c.models) : null
  } catch (err) {
    if (err.code === "ENOENT") return null
    console.warn(`models cache is corrupt: ${cachePath} (${err.message})`)
    return null
  }
}

export async function refreshModels(opts = {}) {
  const env = opts.env || process.env
  const cachePath = opts.cachePath || defaultCachePath()
  validateCachePath(cachePath)
  const out = await new Promise((res, rej) =>
    execFile("opencode", ["models"], { timeout: 30000, env }, (err, stdout) =>
      err ? rej(new Error(`opencode models failed: ${err.message}`)) : res(stdout)))
  const models = out.split("\n").map((s) => s.trim()).filter(Boolean)
  mkdirSync(dirname(cachePath), { recursive: true })
  writeFileSync(cachePath, JSON.stringify({ updatedAt: new Date().toISOString(), models }, null, 2))
  return new Set(models)
}

// Render a two-column "role -> primary / fallback" table for `armada models`.
export function renderCatalog(budget = "balanced", availability = null) {
  const rows = ROLES.map((role) => {
    const e = CATALOG[role]
    const primary = modelFor(role, budget)
    const mark = availability ? (availability.has(primary) ? "✓" : "✗") : ""
    const recommended = ` (Recommended)`
    return [displayFor(role), `${mark}${primary}${recommended}`, e.fallback || ""]
  })
  const roleWidth = Math.max("display name".length, ...rows.map((r) => r[0].length))
  const modelWidth = Math.max("model".length, ...rows.map((r) => r[1].length))
  const fallbackWidth = Math.max("fallback".length, ...rows.map((r) => r[2].length))
  const header = ["display name".padEnd(roleWidth), "model".padEnd(modelWidth), "fallback".padEnd(fallbackWidth)]
  const body = rows.map((r) => [r[0].padEnd(roleWidth), r[1].padEnd(modelWidth), r[2].padEnd(fallbackWidth)])
  return [header.join("  "), body.map((r) => r.join("  ")).join("\n")].join("\n")
}

// fetch a live model list from the OpenRouter API.
export async function listOpenRouterModels(opts = {}) {
  const fetch = opts.fetch || globalThis.fetch
  const url = opts.url || "https://openrouter.ai/api/v1/models"
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.data) throw new Error("missing data field in response")
    return json.data.map((m) => ({ id: m.id, name: m.name }))
  } catch (err) {
    throw new Error(`${err.message} — check network / OPENROUTER_API_KEY`)
  }
}

// render two-column "id  name" table with auto-sized widths.
export function renderOpenRouterModels(models) {
  const entries = models.map((m) => ({
    id: String(m?.id ?? ""),
    name: String(m?.name ?? ""),
  }))
  const idHeader = "id"
  const nameHeader = "name"
  const idWidth = Math.max(idHeader.length, ...entries.map((m) => m.id.length))
  const nameWidth = Math.max(nameHeader.length, ...entries.map((m) => m.name.length))
  const header = `${idHeader.padEnd(idWidth)}  ${nameHeader.padEnd(nameWidth)}`
  const rows = entries.map((m) => `${m.id.padEnd(idWidth)}  ${m.name.padEnd(nameWidth)}`)
  return [header, ...rows].join("\n")
}
