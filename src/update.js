// armada update — bring an existing repo fully current.
// Re-scaffolds armada-owned files and surgically merges opencode.json.
//
// Pure of I/O side effects where reasonable; returns result objects the CLI
// caller uses to determine exit codes and print summaries.

import { existsSync, readFileSync, writeFileSync, lstatSync, realpathSync } from "node:fs"
import { resolve, join, sep } from "node:path"
import { isDeepStrictEqual } from "node:util"

import { parseManifestYaml } from "./manifest.js"
import { buildTeam, mergeOpenCodeJson, ARMADA_OWNED_KEYS } from "./generator.js"
import { scaffold } from "./scaffold.js"
import { confirm } from "./questionnaire.js"

// ---- helpers ----------------------------------------------------------------

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v)
}

function describeVal(v) {
  if (v === undefined) return "(absent)"
  if (typeof v === "string") return JSON.stringify(v)
  if (isPlainObject(v)) return "{ ... }"
  if (Array.isArray(v)) return "[ ... ]"
  return String(v)
}

function computeChanges(existing, merged, prefix = "") {
  const changes = []
  const ex = isPlainObject(existing) ? existing : {}

  for (const key of Object.keys(merged)) {
    const path = prefix ? `${prefix}.${key}` : key
    const exVal = key in ex ? ex[key] : undefined
    const mergedVal = merged[key]

    if (isDeepStrictEqual(exVal, mergedVal)) continue

    if (isPlainObject(exVal) && isPlainObject(mergedVal)) {
      changes.push(...computeChanges(exVal, mergedVal, path))
    } else {
      changes.push({ path, from: describeVal(exVal), to: describeVal(mergedVal) })
    }
  }
  return changes
}

function formatPlan(plan, scaffoldFiles) {
  const lines = ["armada update — plan", ""]

  lines.push("opencode.json changes:")
  if (plan.changes.length === 0) {
    lines.push("  (no change)")
  } else {
    for (const c of plan.changes) {
      lines.push(`  ${c.path}: ${c.from} -> ${c.to}`)
    }
  }
  if (plan.preservedCount > 0) {
    const keyNames = plan.preservedKeys.sort().join(", ")
    lines.push(`Preserved: ${plan.preservedCount} user keys (${keyNames})`)
  } else {
    lines.push("Preserved: 0 user keys")
  }
  lines.push("")

  lines.push("Re-scaffold (.opencode/, armada.yaml):")
  if (scaffoldFiles.length === 0) {
    lines.push("  (no change)")
  } else {
    for (const f of scaffoldFiles) {
      lines.push(`  + ${f}`)
    }
  }

  return lines.join("\n")
}

/**
 * Parse --repo from CLI args. Supports both --repo=value and --repo value forms.
 * Last --repo wins when multiple are present. Throws if --repo is present but
 * missing a value. Returns resolved cwd when --repo is absent.
 *
 * @param {string[]} args - CLI arguments
 * @param {string} cwd - current working directory
 * @returns {string} resolved repo path
 */
export function parseRepoArg(args, cwd) {
  // Check if --repo appears in any form
  const hasRepo = args.some((a) => a === "--repo" || a.startsWith("--repo="))
  if (!hasRepo) return resolve(cwd)

  // Find last occurrence position of either form
  let lastPos = args.lastIndexOf("--repo")
  for (let i = args.length - 1; i >= 0; i--) {
    if (args[i].startsWith("--repo=")) {
      lastPos = Math.max(lastPos, i)
      break
    }
  }

  const arg = args[lastPos]
  if (arg === "--repo") {
    const next = args[lastPos + 1]
    if (next === undefined || next.startsWith("-")) {
      throw new Error("--repo requires a path argument")
    }
    return resolve(cwd, next)
  }

  // arg starts with "--repo="
  return resolve(cwd, arg.slice("--repo=".length))
}

/**
 * Validate that target paths (opencode.json and armada/) are not symlinks that
 * point outside the repo. Throws if a path is a symlink escaping the repo.
 *
 * @param {string} repo - resolved repo root
 * @param {string} ocPath - path to opencode.json
 * @param {string} armadaDirPath - path to armada/ directory
 */
export function validateTargetPaths(repo, ocPath, armadaDirPath) {
  const repoReal = realpathSync(repo)

  function isInside(child, parent) {
    return child === parent || child.startsWith(parent + sep)
  }

  function checkPath(pathToCheck, label) {
    let stat
    try {
      stat = lstatSync(pathToCheck)
    } catch (e) {
      if (e.code === "ENOENT") return // file doesn't exist yet, ok
      throw e
    }
    if (stat.isSymbolicLink()) {
      const targetReal = realpathSync(pathToCheck)
      if (!isInside(targetReal, repoReal)) {
        throw new Error(`${label} is a symlink that points outside the repo`)
      }
    }
  }

  checkPath(ocPath, "opencode.json")
  checkPath(armadaDirPath, "armada/")
}

// ---- main -------------------------------------------------------------------

/**
 * Run the `armada update` command.
 *
 * @param {string[]} args  - CLI arguments (after "update")
 * @param {object}   opts  - { cwd, input, output }
 * @returns {Promise<{code: number, plan?: object, reason?: string}>}
 */
export async function runUpdate(args, opts = {}) {
  const cwd = opts.cwd ?? process.cwd()
  const stdin = opts.input ?? process.stdin
  const stdout = opts.output ?? process.stdout

  const yes = args.includes("--yes")
  const dryRun = args.includes("--dry-run")

  // Parse --repo with last-wins, equals-form support, missing-value error
  let repo
  try {
    repo = parseRepoArg(args, cwd)
  } catch (err) {
    console.error(`Error: ${err.message}`)
    return { code: 1, reason: "bad-repo-arg" }
  }

  // 1. Read armada/armada.yaml
  const manifestPath = join(repo, "armada/armada.yaml")
  if (!existsSync(manifestPath)) {
    console.error(`Error: armada/armada.yaml not found in ${repo}. Run 'armada init' first.`)
    return { code: 1, reason: "missing-manifest" }
  }

  // 2. Parse manifest
  let manifest
  try {
    manifest = parseManifestYaml(readFileSync(manifestPath, "utf8"))
  } catch (err) {
    console.error(String(err?.message ?? err))
    return { code: 1, reason: "bad-manifest" }
  }

  // 3. Read existing opencode.json
  const ocPath = join(repo, "opencode.json")
  let existing = null
  if (existsSync(ocPath)) {
    let raw
    try {
      raw = readFileSync(ocPath, "utf8")
      existing = JSON.parse(raw)
    } catch {
      console.error(`Error: ${repo}/opencode.json is not valid JSON`)
      return { code: 1, reason: "bad-opencode-json" }
    }
    if (existing !== null && !isPlainObject(existing)) {
      console.error(`Error: ${repo}/opencode.json must be a JSON object`)
      return { code: 1, reason: "bad-opencode-json" }
    }
  }
  const existingObj = isPlainObject(existing) ? existing : {}

  // 4. Build team
  const team = buildTeam(manifest)

  // 5. Merge
  const merged = mergeOpenCodeJson(existingObj, manifest, team)

  // 6. Compute plan
  const changes = computeChanges(existingObj, merged)
  const preservedKeys = Object.keys(existingObj).filter((k) => !ARMADA_OWNED_KEYS.has(k))
  const wouldWriteOpencodeJson = !isDeepStrictEqual(existingObj, merged)

  manifest.targetDir = repo
  const stack = manifest.project.stack || {}

  const plan = {
    existing: existingObj,
    merged,
    changes,
    preservedCount: preservedKeys.length,
    preservedKeys,
    wouldWriteOpencodeJson,
  }

  // Get scaffold file list (dry-run preview)
  const scaffoldFiles = scaffold(manifest, stack, { dryRun: true, gitignore: true })

  const planText = formatPlan(plan, scaffoldFiles)

  // 8. --dry-run
  if (dryRun) {
    stdout.write(planText + "\n")
    if (!plan.wouldWriteOpencodeJson && scaffoldFiles.length === 0) {
      stdout.write("armada update: already up to date.\n")
    } else {
      stdout.write("(dry-run) No files written.\n")
    }
    return { code: 0, plan }
  }

  // 9. --yes
  if (yes) {
    // Validate target paths before writing
    try {
      validateTargetPaths(repo, ocPath, join(repo, "armada"))
    } catch (err) {
      console.error(`Error: ${err.message}`)
      return { code: 1, reason: "bad-target-path" }
    }
    scaffold(manifest, stack, { dryRun: false, gitignore: true })
    if (plan.wouldWriteOpencodeJson) {
      writeFileSync(ocPath, JSON.stringify(plan.merged, null, 2) + "\n")
    }
    stdout.write("armada update: done.\n")
    return { code: 0, plan }
  }

  // 10. Interactive (no --yes, no --dry-run)
  stdout.write(planText + "\n")

  // Non-interactive fallback
  if (opts.input !== undefined || !process.stdin.isTTY) {
    stdout.write("Warning: stdin is not interactive and --yes not given. Nothing written. Use --dry-run to preview or --yes to apply.\n")
    return { code: 0, plan }
  }

  // Interactive confirm
  const ok = await confirm("Apply these changes?", true, { input: stdin, output: stdout })
  if (ok === true) {
    // Validate target paths before writing
    try {
      validateTargetPaths(repo, ocPath, join(repo, "armada"))
    } catch (err) {
      console.error(`Error: ${err.message}`)
      return { code: 1, reason: "bad-target-path" }
    }
    scaffold(manifest, stack, { dryRun: false, gitignore: true })
    if (plan.wouldWriteOpencodeJson) {
      writeFileSync(ocPath, JSON.stringify(plan.merged, null, 2) + "\n")
    }
    stdout.write("armada update: done.\n")
  } else {
    stdout.write("Aborted.\n")
  }
  return { code: 0, plan }
}
