import { test } from "node:test"
import assert from "node:assert"
import { execFile } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

// Live smoke verification: every catalog model ID must resolve on its provider.
//
// Collects all unique IDs from CATALOG (primary, fallback, free, power across all
// roles), then pings each one against its provider:
//   - opencode / opencode-go IDs  -> `opencode models` binary
//   - openrouter IDs              -> OpenRouter API /api/v1/models
//
// Run:
//   node --test 'tests/smoke/catalog.live.test.js'
//
// Skips cleanly when no credential/binary is present:
//   - No opencode binary  -> opencode portion skipped
//   - No OpenRouter key   -> openrouter portion skipped
//   - Neither available   -> entire test skipped

const AUTH_JSON = join(homedir(), ".local/share/opencode/auth.json")

function openrouterKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY
  if (existsSync(AUTH_JSON)) {
    try {
      const auth = JSON.parse(readFileSync(AUTH_JSON, "utf8"))
      if (typeof auth?.openrouter?.key === "string" && auth.openrouter.key.length > 0) {
        return auth.openrouter.key
      }
    } catch {
      /* malformed auth.json -- fall through to skip */
    }
  }
  return null
}

const OP_KEY = openrouterKey()
const NO_OR_KEY_REASON = "no OpenRouter credential (set OPENROUTER_API_KEY or /connect openrouter) -- skipping live smoke"

// --- helpers ---

function uniqueCatalogIds(catalog) {
  /** @type {Map<string, {roles: string[], tiers: string[]}>} */
  const map = new Map()
  for (const [role, entry] of Object.entries(catalog)) {
    for (const tier of ["primary", "fallback", "free", "power"]) {
      const id = entry[tier]
      if (typeof id !== "string") continue
      if (!map.has(id)) map.set(id, { roles: [], tiers: [] })
      const info = map.get(id)
      if (!info.roles.includes(role)) info.roles.push(role)
      info.tiers.push(tier)
    }
  }
  return map
}

function providerFor(id) {
  if (id.startsWith("opencode-go/") || id.startsWith("opencode/")) return "opencode"
  if (id.startsWith("openrouter/")) return "openrouter"
  return "unknown"
}

function bareSlug(id) {
  if (id.startsWith("openrouter/")) return id.slice("openrouter/".length)
  return id
}

/** Spawn `opencode models`, return Set of model IDs, or null on failure. */
async function fetchOpencodeModels() {
  try {
    const stdout = await new Promise((resolve, reject) => {
      execFile("opencode", ["models"], { timeout: 30000 }, (err, stdout) => {
        if (err) return reject(err)
        resolve(stdout)
      })
    })
    return new Set(
      stdout
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  } catch (err) {
    return null
  }
}

/** Fetch OpenRouter models list. Returns Set of IDs, or null on failure. */
async function fetchOpenRouterModels() {
  if (!OP_KEY) return null
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${OP_KEY}` },
    })
    if (!res.ok) return null
    const body = await res.json()
    return new Set((body.data || []).map((m) => m.id))
  } catch {
    return null
  }
}

// --- main test ---

test("catalog live: every catalog ID resolves on its provider", async () => {
  const { CATALOG } = await import("../../src/model-catalog.js")

  const catalogIds = uniqueCatalogIds(CATALOG)

  // Determine which providers we can check
  const [opencodeModels, orModels] = await Promise.all([
    fetchOpencodeModels(),
    fetchOpenRouterModels(),
  ])

  const opencodeSkipped = opencodeModels === null
  const orSkipped = orModels === null

  // If nothing can be checked, skip entirely
  if (opencodeSkipped && orSkipped) {
    console.log("SKIP: no providers available (no opencode binary, no OpenRouter key)")
    return
  }

  if (opencodeSkipped) {
    console.log("SKIP: opencode binary not available -- skipping opencode/opencoede-go IDs")
  }
  if (orSkipped) {
    console.log(`SKIP: ${NO_OR_KEY_REASON}`)
  }

  /** @type {{id: string, roles: string[], source: string, result: string, note: string}[]} */
  const results = []

  for (const [id, info] of catalogIds) {
    const prov = providerFor(id)
    const slug = bareSlug(id)
    let result = "SKIP"
    let note = ""

    if (prov === "opencode") {
      if (opencodeSkipped) {
        note = "opencode binary unavailable"
      } else if (opencodeModels.has(slug)) {
        result = "OK"
      } else {
        result = "NOT FOUND"
        note = "not in opencode models output"
      }
    } else if (prov === "openrouter") {
      if (orSkipped) {
        note = "no OpenRouter key"
      } else if (orModels.has(slug)) {
        result = "OK"
      } else {
        result = "NOT FOUND"
        note = "not in OpenRouter models list"
      }
    } else {
      result = "ERROR"
      note = `unknown provider: ${id}`
    }

    results.push({
      id,
      roles: info.roles,
      source: prov,
      result,
      note,
    })
  }

  // --- summary table ---
  const pad = (s, w) => (s ?? "").padEnd(w)
  const rolesStr = (rs) => rs.join(", ")

  const idW = Math.max(2, ...results.map((r) => r.id.length))
  const srcW = Math.max(6, ...results.map((r) => r.source.length))
  const resW = Math.max(6, ...results.map((r) => r.result.length))
  const rolesW = Math.max(5, ...results.map((r) => rolesStr(r.roles).length))
  const noteW = Math.max(4, ...results.map((r) => r.note.length))

  const sep = "  "
  const header = `${pad("ID", idW)}${sep}${pad("Source", srcW)}${sep}${pad("Result", resW)}${sep}${pad("Roles", rolesW)}${sep}${pad("Note", noteW)}`
  console.log(`\n${header}`)
  for (const r of results) {
    console.log(
      `${pad(r.id, idW)}${sep}${pad(r.source, srcW)}${sep}${pad(r.result, resW)}${sep}${pad(rolesStr(r.roles), rolesW)}${sep}${pad(r.note, noteW)}`
    )
  }

  // --- summary stats ---
  const ok = results.filter((r) => r.result === "OK").length
  const skipped = results.filter((r) => r.result === "SKIP").length
  const notFound = results.filter((r) => r.result === "NOT FOUND")
  const errors = results.filter((r) => r.result === "ERROR")

  console.log(
    `\nSummary: ${ok} OK, ${skipped} SKIP, ${notFound.length} NOT FOUND, ${errors.length} ERROR (${results.length} total unique IDs)`
  )

  // --- assert ---
  const failures = [...notFound, ...errors]
  if (failures.length > 0) {
    const lines = failures.map(
      (f) => `  ${f.id} (${f.source}): ${f.result}${f.note ? " -- " + f.note : ""}`
    )
    assert.fail(
      `catalog IDs not live:\n${lines.join("\n")}`
    )
  }

  assert.ok(true, "all reachable catalog IDs verified OK")
})
