import { execFile } from "node:child_process"
import { existsSync, lstatSync, realpathSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { displayFor, agentNameFor } from "./role-display.js"
import { CATALOG, ROLES, BUDGETS, modelFor } from "./model-catalog.js"

// Minimum supported Opencode version for armada compatibility.
export const MIN_OPENCODE = "1.18.0"

function run(bin, args, env) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 15000, env }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: `${stdout ?? ""}${stderr ?? ""}`.trim() }))
  })
}

function firstLine(out, fallback) {
  const line = out.split("\n").map((l) => l.trim()).find((l) => l.length > 0)
  return line ?? fallback
}

function findOnPath(name, env) {
  for (const dir of (env.PATH ?? "").split(":")) {
    const full = join(dir, name)
    try {
      const st = lstatSync(full)
      if (st.isFile() || st.isSymbolicLink()) return full
    } catch {}
  }
  return null
}

// Parse an opencode version string from its --version output.
// Accepts: "1.18.11", "opencode v1.18.11", "v1.18.11", etc.
export function parseOpenCodeVersion(output) {
  if (!output || typeof output !== "string") return null
  // Match x.y.z (semver with 3 numeric parts)
  const m = output.match(/(\d+\.\d+\.\d+)/)
  if (!m) return null
  return m[1]
}

// Check whether a parsed opencode version is within the supported range.
// Returns { status, detail } suitable for doctor check output.
export function checkOpenCodeVersion(versionOrOutput, minVersion = MIN_OPENCODE) {
  const parsed = parseOpenCodeVersion(versionOrOutput)
  if (!parsed) {
    return {
      status: "fail",
      detail: `unrecognized version format — expected semver like 1.18.0, got "${versionOrOutput?.slice(0, 80) ?? ""}"`,
    }
  }
  const parts = parsed.split(".").map(Number)
  const minParts = minVersion.split(".").map(Number)
  for (let i = 0; i < 3; i++) {
    const a = parts[i] ?? 0
    const b = minParts[i] ?? 0
    if (a > b) break
    if (a < b) {
      return {
        status: "fail",
        detail: `${parsed} is below minimum supported version (>= ${minVersion} required) — "${parsed}" is unsupported`,
      }
    }
  }
  return {
    status: "pass",
    detail: `${parsed} — within supported range (>= ${minVersion})`,
  }
}

export function checkCatalogConsistency() {
  const checks = []

  for (const role of ROLES) {
    const entry = CATALOG[role]
    if (!entry) {
      checks.push({
        name: "catalog consistency",
        status: "fail",
        detail: `role "${role}" missing from CATALOG`,
      })
      continue
    }
    for (const budget of BUDGETS) {
      let model
      try {
        model = modelFor(role, budget)
      } catch {
        model = null
      }
      if (!model) {
        checks.push({
          name: "catalog consistency",
          status: "fail",
          detail: `role "${role}" has no model for budget "${budget}"`,
        })
      } else {
        const parts = model.split("/")
        if (parts.length < 2 || !parts[0] || !parts.slice(1).join("/")) {
          checks.push({
            name: "catalog consistency",
            status: "fail",
            detail: `role "${role}" budget "${budget}": model "${model}" is not provider/model format`,
          })
        }
      }
    }
    // Check that balanced tier defaults to opencode-go or opencode for dev roles
    if (["orchestrator", "backend-dev", "frontend-dev", "adversary"].includes(role)) {
      const primary = entry.primary
      if (!primary.startsWith("opencode-go/") && !primary.startsWith("opencode/")) {
        checks.push({
          name: "catalog consistency",
          status: "warn",
          detail: `role "${role}" primary "${primary}" should use opencode-go or opencode provider for balanced tier`,
        })
      }
    }
  }

  if (checks.length === 0) {
    checks.push({
      name: "catalog consistency",
      status: "pass",
      detail: "all roles have valid provider/model entries for every budget tier",
    })
  }

  return checks
}

function extractFrontmatterModel(mdContent) {
  const m = mdContent.match(/^---\n([\s\S]*?)\n---\n/)
  if (!m) return null
  const fm = m[1]
  const modelLine = fm.split("\n").find((l) => /^model:/.test(l))
  if (!modelLine) return null
  return modelLine.replace(/^model:\s*/, "").replace(/^["']|["']$/g, "").trim()
}

export async function checkModelDrift(repoPath) {
  const fs = await import("node:fs/promises")
  const path = await import("node:path")
  const { parseManifestYaml } = await import("./manifest.js")
  const manifestPath = path.join(repoPath, "armada", "armada.yaml")
  let manifest
  try {
    const text = await fs.readFile(manifestPath, "utf8")
    manifest = parseManifestYaml(text)
  } catch (err) {
    return [{ name: "model-drift", status: "warn", detail: `cannot read ${manifestPath}: ${err.message}` }]
  }
  const team = manifest.team || []
  const checks = []
  for (const entry of team) {
    if (entry.enabled === false) continue
    const fileBase = agentNameFor(entry.role)
    const agentPath = path.join(repoPath, ".opencode", "agent", `${fileBase}.md`)
    let fileModel
    try {
      const content = await fs.readFile(agentPath, "utf8")
      fileModel = extractFrontmatterModel(content)
    } catch {
      checks.push({
        name: "model-drift",
        status: "warn",
        detail: `role '${entry.role}': .opencode/agent/${fileBase}.md not found`,
      })
      continue
    }
    if (fileModel !== entry.model) {
      checks.push({
        name: "model-drift",
        status: "warn",
        detail: `role '${entry.role}': armada.yaml says "${entry.model}" but .opencode/agent/${fileBase}.md says "${fileModel ?? "(none)"}"`,
      })
    }
  }
  if (checks.length === 0) {
    checks.push({ name: "model-drift", status: "pass", detail: "all role frontmatters match armada.yaml" })
  }
  return checks
}

export async function runDoctor(opts = {}) {
  const env = opts.env ?? process.env
  const checks = []

  const v = await run("opencode", ["--version"], env)
  checks.push({
    name: "opencode CLI",
    status: v.ok ? "pass" : "fail",
    detail: v.ok ? v.out || "exit 0" : firstLine(v.out, "command failed"),
  })

  checks.push({
    name: "opencode version range",
    ...(v.ok ? checkOpenCodeVersion(v.out) : { status: "fail", detail: "opencode --version failed" }),
  })

  const auth = await run("opencode", ["providers", "list"], env)
  checks.push({
    name: "providers auth",
    status: auth.ok ? "pass" : "fail",
    detail: firstLine(auth.out, auth.ok ? "exit 0" : "command failed"),
  })

  const orAuth = await run("opencode", ["auth", "list"], env)
  const hasOpenrouter = orAuth.ok && /openrouter/i.test(orAuth.out)
  const orEnv = typeof env.OPENROUTER_API_KEY === "string" && env.OPENROUTER_API_KEY.length > 0
  checks.push({
    name: "openrouter auth",
    status: hasOpenrouter || orEnv ? "pass" : "fail",
    detail: hasOpenrouter
      ? "openrouter credential found (opencode auth list)"
      : orEnv
        ? "OPENROUTER_API_KEY set"
        : "no openrouter credential — run /connect openrouter or set OPENROUTER_API_KEY (power preset needs it)",
  })

  const bg = env.OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS === "true"
  checks.push({
    name: "background dispatch",
    status: "pass",
    detail: bg
      ? "OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true (native parallel background subagents)"
      : "OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS not set — parallel background dispatch disabled (inline fallback)",
  })

  checks.push({ name: "node", status: "pass", detail: process.version })

  // Use the running binary (selfPath) if provided, otherwise check PATH.
  // This prevents stale PATH entries from producing misleading output.
  const selfPath = opts.selfPath ?? null
  if (selfPath) {
    const selfRun = await run(process.execPath, [selfPath, "--version"], env)
    checks.push({
      name: "global armada binary",
      status: selfRun.ok ? "pass" : "fail",
      detail: selfRun.ok ? selfRun.out || "exit 0" : firstLine(selfRun.out, "self-check failed"),
    })
  } else {
    const armadaDirOnPath = (env.PATH ?? "").split(":").some((dir) => {
      try { return lstatSync(join(dir, "armada")).isDirectory() } catch { return false }
    })
    if (armadaDirOnPath) {
      checks.push({
        name: "global armada binary",
        status: "fail",
        detail: "a directory named armada is on PATH — remove it or ensure a proper binary has priority",
      })
    } else {
      const armadaPath = findOnPath("armada", env)
      if (armadaPath) {
        try {
          realpathSync(armadaPath)
          const armadaRun = await run("armada", ["help"], env)
          checks.push({
            name: "global armada binary",
            status: armadaRun.ok ? "pass" : "fail",
            detail: armadaRun.ok ? armadaRun.out || "exit 0" : firstLine(armadaRun.out, "armada command failed"),
          })
        } catch (err) {
          const isLoop = err?.code === 'ELOOP'
          checks.push({
            name: "global armada binary",
            status: "fail",
            detail: isLoop
              ? `symlink loop detected at ${armadaPath} — remove the loop and re-link`
              : "broken symlink — run npm link from ~/WBG/armada",
          })
        }
      } else {
        checks.push({
          name: "global armada binary",
          status: "fail",
          detail: "armada not on PATH — run npm link from ~/WBG/armada",
        })
      }
    }
  }

  const team = opts.team ?? []
  const enabled = team.filter((t) => t && t.enabled !== false)
  if (enabled.length > 0) {
    const lines = enabled.map((t) => `${displayFor(t.role)}: ${t.model}`)
    checks.push({ name: "team roster", status: "pass", detail: lines.join("\n") })
  } else {
    checks.push({ name: "team roster", status: "pass", detail: "no team" })
  }

  if (opts.project?.supervision?.plugin) {
    const pluginPath = join(opts.targetDir ?? ".", ".opencode/plugins/armada-supervision.js")
    checks.push({
      name: "supervision plugin",
      status: existsSync(pluginPath) ? "pass" : "fail",
      detail: existsSync(pluginPath)
        ? ".opencode/plugins/armada-supervision.js present"
        : "supervision.plugin is true but .opencode/plugins/armada-supervision.js missing — re-run armada init",
    })
  }
  if (opts.project?.supervision?.fleet) {
    const pluginPath = join(opts.targetDir ?? ".", ".opencode/plugins/armada-fleet.js")
    checks.push({
      name: "fleet tracker plugin",
      status: existsSync(pluginPath) ? "pass" : "fail",
      detail: existsSync(pluginPath)
        ? ".opencode/plugins/armada-fleet.js present"
        : "supervision.fleet is true but .opencode/plugins/armada-fleet.js missing — re-run armada init",
    })
  } else if (opts.project?.supervision !== undefined && opts.project.supervision.fleet === false) {
    checks.push({
      name: "fleet tracker plugin",
      status: "pass",
      detail: "disabled by user (--no-fleet-tracker)",
    })
  }
  if (opts.project?.supervision?.watchdog) {
    const pluginPath = join(opts.targetDir ?? ".", ".opencode/plugins/armada-watchdog.js")
    checks.push({
      name: "watchdog plugin",
      status: existsSync(pluginPath) ? "pass" : "fail",
      detail: existsSync(pluginPath)
        ? ".opencode/plugins/armada-watchdog.js present"
        : "supervision.watchdog is true but .opencode/plugins/armada-watchdog.js missing — re-run armada init",
    })
  }

  if (opts.project?.supervision?.shipnames !== undefined) {
    const pluginPath = join(opts.targetDir ?? ".", ".opencode/plugins/armada-shipnames.js")
    if (opts.project.supervision.shipnames === false) {
      checks.push({
        name: "shipnames plugin",
        status: "pass",
        detail: "disabled by user (--no-shipnames)",
      })
    } else if (existsSync(pluginPath)) {
      let status = "pass"
      let detail = ".opencode/plugins/armada-shipnames.js present"
      try {
        const src = readFileSync(pluginPath, "utf8")
        // Validate structural markers — module-level exports cannot be checked
        // via new Function(), but well-formed plugin output is guaranteed by the
        // generator. A manually-edited file missing these markers is corrupt.
        if (!src.includes("ArmadaShipnames") || !src.includes("tool.execute.before")) {
          status = "fail"
          detail = ".opencode/plugins/armada-shipnames.js present but missing expected exports — re-run armada init"
        }
      } catch {
        status = "fail"
        detail = ".opencode/plugins/armada-shipnames.js present but unreadable — re-run armada init"
      }
      checks.push({ name: "shipnames plugin", status, detail })
    } else {
      checks.push({
        name: "shipnames plugin",
        status: "skip",
        detail: ".opencode/plugins/armada-shipnames.js not present (opted out or not yet scaffolded)",
      })
    }
  }

  if (opts.targetDir) {
    checks.push(...(await checkModelDrift(opts.targetDir)))
  }

  checks.push(...checkCatalogConsistency())

  return checks
}
