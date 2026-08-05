#!/usr/bin/env node
// armada CLI — entry point.
//
// Commands (11 total):
//   armada init                 interactive questionnaire -> writes team config
//   armada new                  create new project from starter template
//   armada doctor               check providers + env + background dispatch
//   armada status [--json] [--feature <name>]  feature status from armada/state
//   armada fleet [session]      per-lane progress dashboard
//   armada voyage <path>        boot a lane + send voyage prompt
//   armada feature new|list|close  per-feature contract management
//   armada models [--refresh]   curated model catalog
//   armada reconcile [--json] [--state-dir <p>] [--repo <p>]
//                           check for evidence drift; alias for resume
//   armada help                 this help
//   armada uninstall [--all]    remove armada-generated artifacts
//   armada resume               resume after interrupted session

// Check runtime before any imports or execution.
// Block early: Node < 20 is unsupported.
export function checkNodeRuntime(version = process.versions.node) {
  const major = parseInt(version.split(".")[0], 10)
  if (Number.isNaN(major) || major < 20) {
    return `Unsupported runtime: Node.js >= 20 required (detected v${version}). Upgrade to Node 20 or later and retry.`
  }
  return null
}

const runtimeError = checkNodeRuntime()
if (runtimeError) {
  process.stderr.write(runtimeError + "\n")
  process.exit(1)
}

import { existsSync, readFileSync, realpathSync } from "node:fs"
import { basename, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { runQuestionnaire, guessName, confirm } from "./questionnaire.js"
import { detectStack } from "./stack-detect.js"
import { scaffold, uninstall } from "./scaffold.js"
import { renderCatalog, BUDGETS, ROLES, modelFor, refreshModels, loadModelsCache, listOpenRouterModels, renderOpenRouterModels } from "./model-catalog.js"
import { parseManifestYaml, validateRequirementsFile } from "./manifest.js"
import { runDoctor } from "./doctor.js"
import { runNew } from "./new-command.js"
import { createFeature, createWorktreeFeature, listFeatures, closeFeature, setActiveContract, readActive, readFeatureEntry } from "./feature-commands.js"
import { main as resumeMain } from "./resume-cli.js"
import { renderInitSummary } from "./init-summary.js"
import { bootLane, DriveError } from "./drive.js"
import { startHeartbeat } from "./heartbeat.js"
import { openTerminal, buildAttachCommand } from "./terminal-open.js"
import { listRuns, readRun } from "./fleet-tracker.js"
import { renderFleetTable, renderFleetDetail, renderFleetJson } from "./fleet-cmd.js"
import { main as statusMain } from "./status-cmd.js"
import { formatHandoffBlock } from "./handoff.js"

// Track active heartbeat intervals so they can be cleaned up on exit.
const activeHeartbeats = new Map()

export const VERSION = "1.0.0"

const HELP = `armada v${VERSION}
Evidence-gated AI-engineer teams for opencode, natively (no plugin).

Usage:
  armada init                                interactive setup
  armada new <name> [--type <c>] [--beginner|--experienced] [--yes]
                          create new project from curated starter template
  armada init --stack <s> --budget <b>       declarative setup
  armada init --headless                     CI-safe: orchestrator bash allowed (opencode run)
  armada init --yolo                         autonomous: no permission prompts (bash allow, edit boundaries kept)
  armada init --supervision-plugin           opt-in thin supervision plugin (.opencode/plugins/)
  armada init --no-fleet-tracker              opt-out from default-on fleet tracker plugin
  armada init --watchdog                      opt-in subagent watchdog plugin (.opencode/plugins/)
  armada init --requirements <file>          per-feature contract file (default armada/REQUIREMENTS.md)
  armada init --target <dir>                 scaffold into a directory (default cwd)
  armada init --from-armada armada/armada.yaml      regenerate from manifest
  armada init --restart                           force re-scaffold; overwrites armada-owned files but preserves user-owned files
  armada doctor                              environment health check
  armada status [--json] [--feature <name>]  feature status from armada/state (table by default)
  armada fleet [session] [--json] [--open]   per-lane progress dashboard (table by default)
  armada voyage <lane-path> [--heartbeat]    boot a lane session and send the voyage prompt (TUI-ready handshake)
  armada voyage-handoff <name> [<name>...]  print handoff block for dispatched voyages
  armada feature new <name>                  create per-feature contract + register
  armada feature list                        list open/in-progress/shipped features
  armada feature close <name>                verify evidence + mark shipped
  armada models [budget]                     show curated model catalog
  armada models --refresh                    merge live provider models
  armada models --list-openrouter            live OpenRouter model list
  armada help                                this help
  armada uninstall [--all] [--force] [--dry-run] [--target <dir>]  remove armada-generated artifacts
  armada resume [--json] [--state-dir <p>] [--repo <p>]
                           check for evidence drifts against contract (exit 2 if drifts)
  armada reconcile [--json] [--state-dir <p>] [--repo <p>]
                           alias for armada resume (check for evidence drifts)

Deprecated (one-version aliases removed in v2.0):
  armada drive <lane-path>                   alias for voyage; prints deprecation hint, calls voyage
  armada update                              deprecated; use 'armada init --from-armada --restart'
  armada preset <name>                       deprecated; use 'armada init --budget <name>'
  armada feature status [name]               deprecated; use 'armada status --feature <name>'

Removed:
  armada scout                               removed; use '/armada-scout' inside the opencode TUI
  armada ping                                removed; use 'armada help' to confirm the binary works
`

/**
 * Validate project name for `armada new`.
 * Rejects: empty, starts with `-`, contains `/`, `\\`, `..`, NUL, absolute paths.
 * @param {string} name
 * @throws {Error} if invalid
 */
function validateProjectName(name) {
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new Error("project name is required")
  }
  if (name.startsWith("-")) {
    throw new Error(`invalid project name "${name}": project names cannot start with '-'`)
  }
  if (name.includes("/") || name.includes("\\")) {
    throw new Error(`invalid project name "${name}": must not contain path separators`)
  }
  if (name.includes("..")) {
    throw new Error(`invalid project name "${name}": must not contain ".."`)
  }
  if (name.includes("\0") || name.includes("\x00")) {
    throw new Error(`invalid project name "${name}": must not contain null bytes`)
  }
  if (name.startsWith("/")) {
    throw new Error(`invalid project name "${name}": must not be an absolute path`)
  }
}

// Token -> stack field mappings for `--stack <hint>`. Only applied when the
// detected stack leaves that field null/empty.
const STACK_HINT_TOKENS = {
  frontend: {
    nextjs: "nextjs", react: "react", vue: "vue", remix: "remix",
    gatsby: "gatsby", svelte: "svelte",
  },
  backend: {
    fastapi: "python-fastapi", django: "python-django", flask: "python-flask",
    express: "node-express", fastify: "node-fastify", nest: "node-nestjs",
    nestjs: "node-nestjs", node: "node",
  },
  database: {
    postgres: "postgres", postgresql: "postgres", mysql: "mysql",
    sqlite: "sqlite", mongodb: "mongodb", mongo: "mongodb",
  },
  testing: {
    playwright: "playwright", pytest: "pytest", jest: "jest",
    vitest: "vitest", cypress: "cypress",
  },
}

// Extract the --stack <hint> value, or undefined when missing/misused.
function stackHint(args) {
  const i = args.indexOf("--stack")
  if (i === -1) return undefined
  const v = args[i + 1]
  return v && !v.startsWith("--") ? v : undefined
}

// Overlay the CLI stack hint onto a detected stack. Token order wins; a field
// already set by detection is left alone. Mutates and returns the stack.
export function applyStackHint(stack, hint) {
  if (!hint) return stack
  const tokens = hint.split(/[-,+_ ]/).filter(Boolean)
  for (const field of Object.keys(STACK_HINT_TOKENS)) {
    for (const token of tokens) {
      const mapped = STACK_HINT_TOKENS[field][token]
      if (mapped && !stack[field]) {
        stack[field] = mapped
        break
      }
    }
  }
  return stack
}

export async function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv

  switch (cmd) {
    case "init":
      return init(rest)
    case "models":
      return models(rest)
    case "doctor":
      return doctor(rest)
    case "uninstall":
      return uninstallCmd(rest)
    case "update":
      console.error("armada update: deprecated; use 'armada init --from-armada --restart'")
      await init(rest)
      process.exitCode = 1
      return 1
    case "new": {
      // Reject --help / -h as project name before passing to runNew
      if (rest[0] === "--help" || rest[0] === "-h") {
        console.log(HELP)
        return 0
      }
      if (rest[0] && rest[0].startsWith("--")) {
        console.error(`Invalid project name: "${rest[0]}" — project names cannot start with '--'`)
        process.exitCode = 1
        return 1
      }
      const name = rest[0]
      try {
        validateProjectName(name)
      } catch (err) {
        console.error(err.message)
        process.exitCode = 1
        return 1
      }
      const typeIdx = rest.indexOf("--type")
      const code = await runNew({
        name,
        type: typeIdx !== -1 ? rest[typeIdx + 1] : undefined,
        beginner: rest.includes("--beginner"),
        experienced: rest.includes("--experienced"),
        yes: rest.includes("--yes"),
      })
      return code ?? process.exitCode ?? 0
    }
    case "feature":
      return featureCmd(rest)
    case "resume":
      return resumeCmd(rest)
    case "reconcile":
      return reconcileCmd(rest)
    case "fleet":
      return fleetCmd(rest)
    case "voyage":
      return driveCmd(rest, "voyage")
    case "drive":
      console.error("armada drive: deprecated; use 'armada voyage' (this alias will be removed in v2.0)")
      return driveCmd(rest, "drive")
    case "preset": {
      console.error("armada preset: deprecated; use 'armada init --budget <name>'")
      // Extract the preset name (first non-flag arg) and --target, forward to init
      const name = rest.find((a) => !a.startsWith("--"))
      const targetIdx = rest.indexOf("--target")
      const target = targetIdx !== -1 && rest[targetIdx + 1] && !rest[targetIdx + 1].startsWith("--") ? rest[targetIdx + 1] : "."
      const initArgs = name ? ["--budget", name] : []
      if (target && target !== ".") initArgs.push("--target", target)
      await init(initArgs)
      process.exitCode = 1
      return 1
    }
    case "--version":
    case "-v":
      process.stdout.write("armada v" + VERSION + "\n")
      return 0
    case "status":
      return statusCmd(rest)
    case "voyage-handoff":
      return voyageHandoffCmd(rest)
    case "help":
    case "-h":
    case "--help":
    case undefined:
      console.log(HELP)
      return
    default:
      console.error(`Unknown command: ${cmd}\n`)
      console.error(HELP)
      process.exitCode = 1
  }
  return process.exitCode ?? 0
}

// Entry when run as a script (node/bun src/cli.js, or the installed `armada`
// bin, which node reaches through a symlink). Guarded so the module can also be
// imported for testing. Realpath comparison so symlink invocation still counts
// as "main" (process.argv[1] is the symlink, import.meta.url the real file).
function resolveEntry(argv1) {
  for (const candidate of [argv1, argv1 && `${argv1}.js`]) {
    try {
      return realpathSync(candidate)
    } catch {
      /* try next */
    }
  }
  return null
}

const isMain =
  typeof process !== "undefined" &&
  resolveEntry(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))

function logError(err, hint) {
  if (process.env.DEBUG === "1") {
    console.error(err)
  } else {
    console.error(err?.message ?? err)
    if (hint) console.error(hint)
  }
}

// Clean up active heartbeats on exit / interrupt
function stopAllHeartbeats() {
  for (const [, hb] of activeHeartbeats) {
    try { hb.stop() } catch { /* best-effort */ }
  }
  activeHeartbeats.clear()
}
process.on("SIGINT", () => {
  stopAllHeartbeats()
  process.exit(0)
})
process.on("SIGTERM", () => {
  stopAllHeartbeats()
  process.exit(0)
})
process.on("exit", () => {
  stopAllHeartbeats()
})

if (isMain) {
  main()
    .then((code) => {
      process.exitCode = code ?? 0
    })
    .catch((err) => {
      logError(err, `check permissions on the target directory`)
      process.exitCode = 1
    })
}

async function init(args) {
  // Intercept --help / -h before any parsing
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP)
    return 0
  }

  const force = args.includes("--restart")

  const targetIdx = args.indexOf("--target")
  const target = targetIdx !== -1 && args[targetIdx + 1] && !args[targetIdx + 1].startsWith("--") ? args[targetIdx + 1] : "."

  const fromArmadaIdx = args.indexOf("--from-armada")
  let manifest = null

  if (fromArmadaIdx !== -1) {
    const file = args[fromArmadaIdx + 1]
    if (!file || file.startsWith("--")) {
      console.error(`Manifest not found: (missing)`)
      process.exitCode = 1
      return 1
    }
    if (!existsSync(resolve(file))) {
      console.error(`Manifest not found: ${file}`)
      process.exitCode = 1
      return 1
    }
    try {
      manifest = parseManifestYaml(readFileSync(resolve(file), "utf8"))
    } catch (err) {
      console.error(String(err?.message ?? err))
      process.exitCode = 1
      return 1
    }
  } else {
    const nonInteractive = args.includes("--yes") || !process.stdin.isTTY
    manifest = nonInteractive ? defaultManifest(target) : await runQuestionnaire(target)
  }

  // Apply declarative overrides.
  manifest.targetDir = target

  const budgetIdx = args.indexOf("--budget")
  if (budgetIdx !== -1) {
    const budget = args[budgetIdx + 1]
    if (!budget || !BUDGETS.includes(budget)) {
      console.error(`unknown budget: "${budget || "(missing)"}". Available: ${BUDGETS.join(", ")}`)
      process.exitCode = 1
      return 1
    }
    manifest.project.budget = budget
    // Budget tier selects per-role models (free/balanced/power). Without this,
    // default manifests bake balanced models and the flag only changes the
    // project model, leaving agent frontmatter on the wrong tier.
    manifest.team = manifest.team.map((t) => ({ ...t, model: modelFor(t.role, budget) }))
  }
  const noBrowser = args.includes("--no-browser")
  if (noBrowser) {
    manifest.project.browserTesting = false
    manifest.project.useAgentBrowser = false
  }
  if (args.includes("--headless")) {
    manifest.project.headless = true
  }
  if (args.includes("--yolo")) {
    manifest.project.yolo = true
  }
  if (args.includes("--supervision-plugin")) {
    manifest.project.supervision = manifest.project.supervision ?? { plugin: false, fleet: true }
    manifest.project.supervision.plugin = true
  }
  if (args.includes("--no-fleet-tracker")) {
    manifest.project.supervision = manifest.project.supervision ?? { plugin: false, fleet: true }
    manifest.project.supervision.fleet = false
  }
  if (args.includes("--fleet-tracker")) {
    console.warn("note: --fleet-tracker is now the default; use --no-fleet-tracker to opt out")
  }
  if (args.includes("--watchdog")) {
    manifest.project.supervision = manifest.project.supervision ?? { plugin: false, fleet: true }
    manifest.project.supervision.watchdog = true
  }
  const reqIdx = args.indexOf("--requirements")
  if (reqIdx !== -1 && args[reqIdx + 1] && !args[reqIdx + 1].startsWith("--")) {
    try {
      validateRequirementsFile(args[reqIdx + 1], manifest.targetDir ?? ".")
    } catch (err) {
      logError(err)
      process.exitCode = 1
      return 1
    }
    manifest.project.requirementsFile = args[reqIdx + 1]
    // Wire the contract as the active feature
    try {
      setActiveContract(resolve(target), args[reqIdx + 1])
    } catch (err) {
      logError(err, `failed to set active contract`)
      process.exitCode = 1
      return 1
    }
  }

  // Always detect the stack from the repo, then overlay any --stack hint onto
  // the detected fields. Stored back into the manifest so armada.yaml reflects it.
  const stack = applyStackHint(
    Object.keys(manifest.project.stack).length ? { ...manifest.project.stack } : detectStack(manifest.targetDir ?? "."),
    stackHint(args))

  manifest.project.stack = stack

  const dryRun = args.includes("--dry-run")

  // Ask about managed .gitignore block (skip when --yes / --yolo / non-TTY)
  const skipGitignore = args.includes("--yes") || args.includes("--yolo") || dryRun
  let gitignore = true
  if (!skipGitignore && process.stdin.isTTY) {
    const ok = await confirm("armada wants to add a managed block to .gitignore (reversible, marked). Continue?", true)
    if (ok === false) gitignore = false
    // ok === null means EOF (Ctrl+D) — treat as skip too
    if (ok === null) gitignore = false
  }

  let files
  try {
    const scaffoldResult = scaffold(manifest, stack, { dryRun, gitignore, force })
    files = scaffoldResult.written
  } catch (err) {
    logError(err, `check permissions on the target directory`)
    process.exitCode = 1
    return 1
  }
  console.log(`\n${dryRun ? "(dry-run) " : ""}Scaffolded armada team:`)
  for (const f of files) console.log(`  ${dryRun ? "(dry-run) + " : "+ "}${f}`)
  console.log(renderInitSummary(manifest))
  if (!gitignore) console.log("\nNote: .gitignore block was skipped. Re-run 'armada init --from-armada armada/armada.yaml' to add it later.")
  return 0
}

// Default (non-interactive) manifest: guessed project name, balanced budget,
// every role enabled at its balanced model, no browser/devcontainer extras.
export function defaultManifest(target = ".") {
  return {
    project: {
      name: guessName(resolve(target)),
      budget: "balanced",
      browserTesting: false,
      devcontainer: false,
      useAgentBrowser: false,
      headless: false,
      yolo: false,
      supervision: { plugin: false, fleet: true, watchdog: false },
      requirementsFile: "armada/REQUIREMENTS.md",
      stack: {},
    },
    team: ROLES.map((role) => ({
      role,
      model: modelFor(role, "balanced"),
      fallback: null,
      enabled: true,
    })),
  }
}

async function models(args) {
  if (args.includes("-h") || args.includes("--help")) { console.log(HELP); return 0 }
  if (args.includes("-v") || args.includes("--version")) { process.stdout.write("armada v" + VERSION + "\n"); return 0 }
  if (args.includes("--list-openrouter")) {
    try {
      const models = await listOpenRouterModels()
      console.log(renderOpenRouterModels(models))
      return 0
    } catch (err) {
      logError(err)
      process.exitCode = 1
      return 1
    }
  }

  const refresh = args.includes("--refresh")
  // Find the first non-flag arg as a budget candidate.
  // Exclude values of flags that take a value (e.g. --cache <path>).
  const cacheIdx = args.indexOf("--cache")
  const skipIdx = cacheIdx !== -1 ? cacheIdx + 1 : -1
  const budgetCandidate = args.find((a, i) => !a.startsWith("-") && i !== skipIdx)
  if (budgetCandidate && !BUDGETS.includes(budgetCandidate)) {
    console.error(`unknown budget: "${budgetCandidate}". Available: ${BUDGETS.join(", ")}`)
    process.exitCode = 1
    return 1
  }
  const budget = budgetCandidate ?? "balanced"
  const cachePath =
    cacheIdx !== -1 && args[cacheIdx + 1] && !args[cacheIdx + 1].startsWith("--")
      ? args[cacheIdx + 1]
      : undefined
  let availability
  if (refresh) {
    try {
      availability = await refreshModels({ cachePath })
    } catch (err) {
      logError(err, `check permissions on ${cachePath ?? "~/.armada"}`)
      process.exitCode = 1
      return 1
    }
  } else {
    availability = loadModelsCache(cachePath)
  }
  console.log(`Model catalog (budget: ${budget})`)
  if (availability) {
    console.log("✓ available on providers   ✗ unavailable (falls back)")
  }
  console.log(renderCatalog(budget, availability))
  return 0
}

async function doctor(args = []) {
  if (args.includes("-h") || args.includes("--help")) { console.log(HELP); return 0 }
  if (args.includes("-v") || args.includes("--version")) { process.stdout.write("armada v" + VERSION + "\n"); return 0 }
  console.log("armada doctor")
  // If the cwd has an armada manifest, surface its supervision.plugin setting so
  // the plugin-presence check runs.
  let manifest
  try {
    const { parseManifestYaml } = await import("./manifest.js")
    const { readFileSync } = await import("node:fs")
    manifest = parseManifestYaml(readFileSync("armada/armada.yaml", "utf8"))
  } catch {
    manifest = null
  }
  const checks = await runDoctor({
    project: manifest?.project,
    team: manifest?.team,
    targetDir: ".",
    selfPath: process.argv[1],
  })
  let anyFail = false
  for (const { name, status, detail } of checks) {
    console.log(`${name}: ${status} — ${detail}`)
    if (status === "fail") anyFail = true
  }
  if (anyFail) process.exitCode = 1
  return anyFail ? 1 : 0
}

async function uninstallCmd(args) {
  if (args.includes("-h") || args.includes("--help")) { console.log(HELP); return 0 }
  if (args.includes("-v") || args.includes("--version")) { process.stdout.write("armada v" + VERSION + "\n"); return 0 }
  const targetIdx = args.indexOf("--target")
  const target = targetIdx !== -1 && args[targetIdx + 1] && !args[targetIdx + 1].startsWith("--") ? args[targetIdx + 1] : "."
  const fileIdx = args.indexOf("--from-armada")
  const file = fileIdx !== -1 ? args[fileIdx + 1] : "armada/armada.yaml"
  const dryRun = args.includes("--dry-run")
  const all = args.includes("--all")
  const force = args.includes("--force")
  let manifest
  if (file && !file.startsWith("--") && existsSync(resolve(file))) {
    try {
      manifest = parseManifestYaml(readFileSync(resolve(file), "utf8"))
    } catch (err) {
      logError(err)
      process.exitCode = 1
      return 1
    }
  } else {
    console.warn("Manifest not found; cleaning by known paths")
    manifest = {
      targetDir: target,
      project: { requirementsFile: "armada/REQUIREMENTS.md" },
    }
  }
  manifest.targetDir = target
  let removed
  try {
    removed = uninstall(manifest, { all, dryRun, force })
  } catch (err) {
    logError(err, `check permissions on the target directory`)
    process.exitCode = 1
    return 1
  }
  console.log(`\n${dryRun ? "(dry-run) " : ""}Removed armada artifacts:`)
  for (const f of removed) console.log(`  ${dryRun ? "(dry-run) - " : "- "}${f}`)
  return 0
}

async function resumeCmd(args) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP)
    return 0
  }
  try {
    return await resumeMain(args, { cwd: process.cwd() })
  } catch (err) {
    logError(err)
    process.exitCode = 1
    return 1
  }
}

async function reconcileCmd(args) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP)
    return 0
  }
  try {
    return await resumeMain(args, { cwd: process.cwd() })
  } catch (err) {
    logError(err)
    process.exitCode = 1
    return 1
  }
}

// Extract a flag value supporting both --flag=value and --flag value forms.
// Returns the value, or undefined if the flag is absent or the next arg is missing/flag-like.
export function flagValue(args, flag) {
  // Check for --flag=value form
  const eqArg = args.find((a) => a.startsWith(`${flag}=`))
  if (eqArg) return eqArg.slice(flag.length + 1)

  // Check for --flag value form
  const idx = args.indexOf(flag)
  if (idx === -1) return undefined
  const v = args[idx + 1]
  if (v === undefined || v.startsWith("-")) return undefined
  return v
}
async function getAutoOpenSuffix(name) {
  try {
    const result = await openTerminal({
      name,
      platform: process.platform,
      env: process.env,
    })
    if (result.opened) {
      if (result.mode === "tab") {
        return ` (auto-attached in tab of ${result.kind})`
      }
      if (result.mode === "window") {
        return ` (auto-attached in new window of ${result.kind})`
      }
      return ` (auto-attached in ${result.kind})`
    }
    if (result.mode === "hint") {
      return ` (auto-attach skipped: ${result.reason})`
    }
    return ` (auto-attach skipped: unable to open terminal)`
  } catch {
    // terminal-open must never fail the drive
    return ` (auto-attach skipped: unable to open terminal)`
  }
}

async function driveCmd(args, cmdName = "drive") {
  // Intercept --help / -h / help before any arg parsing.
  // Deprecation hint is printed by the top-level dispatch (main switch),
  // so do NOT repeat it here; only handle exit code for deprecated aliases.
  if (args.includes("--help") || args.includes("-h") || args[0] === "help") {
    console.log(HELP)
    if (cmdName === "drive") {
      process.exitCode = 1
      return 1
    }
    return 0
  }

  // Subcommand: armada voyage attach <name>
  if (args[0] === "attach") {
    const attachName = args[1]
    if (!attachName || attachName.startsWith("--")) {
      console.error(`Usage: armada ${cmdName} attach <name>`)
      process.exitCode = 1
      return 1
    }
    console.log(buildAttachCommand(attachName))
    return 0
  }

  // Positional arg: <lane-path>, default "."
  const lanePath = args.find((a) => !a.startsWith("--")) || "."

  // --name <session>: tmux session name, default basename of lane path
  const rawName = flagValue(args, "--name")
  const name = rawName ?? basename(resolve(lanePath))

  if (name.startsWith("-")) {
    console.error(`error: session name cannot start with "-" (got: ${name})`)
    process.exitCode = 1
    return 1
  }

  // --no-track: skip fleet tracker recording
  const noTrack = args.includes("--no-track")

  // --prompt <text>: drive prompt
  const DEFAULT_PROMPT = "Voyage the contract in armada/REQUIREMENTS.md. Phase-gate on evidence. Run independent phases in parallel. Don't advance a phase without passing its criteria."
  const rawPrompt = flagValue(args, "--prompt")
  const prompt = rawPrompt ?? DEFAULT_PROMPT

  // Detect --prompt with a value that starts with -- (was filtered out by flagValue)
  const promptIdx = args.indexOf("--prompt")
  if (promptIdx !== -1 && rawPrompt === undefined) {
    const nextArg = args[promptIdx + 1]
    if (nextArg && nextArg.startsWith("--")) {
      console.error(`error: --prompt value cannot start with "--" (use --prompt=<text> if you must)`)
      process.exitCode = 1
      return 1
    }
  }

  // --timeout <ms>: total ready timeout, default 30000
  const rawTimeout = flagValue(args, "--timeout")
  let timeoutMs = 30000
  if (rawTimeout !== undefined) {
    const parsed = parseInt(rawTimeout, 10)
    if (Number.isNaN(parsed)) {
      timeoutMs = 30000
    } else if (parsed <= 0) {
      console.error("error: timeout must be a positive integer")
      process.exitCode = 1
      return 1
    } else {
      timeoutMs = parsed
    }
  }

  const noOpen = args.includes("--no-open")
  const printAttach = args.includes("--print-attach")

  if (printAttach) {
    console.log(buildAttachCommand(name))
    if (cmdName === "drive") {
      process.exitCode = 1
      return 1
    }
    return 0
  }

  // Resolve lane path to absolute and verify it exists
  const absLane = resolve(lanePath)
  if (!existsSync(absLane)) {
    console.error(`lane path not found: ${absLane}`)
    process.exitCode = 1
    return 1
  }

  // cwd: parent of lane path (so team in worktree can see live repo),
  // or process cwd when lane path is "."
  const cwd = lanePath === "." ? process.cwd() : resolve(absLane, "..")

  try {
    const result = await bootLane({
      name,
      cwd,
      command: "opencode",
      prompt,
      timeoutMs,
      tmuxBin: "tmux",
      track: !noTrack,
      cmdName,
    })
    let attachSuffix = ""

    if (result.attached) {
      if (noOpen) {
        attachSuffix = " (--no-open: skipped auto-attach)"
      } else {
        attachSuffix = await getAutoOpenSuffix(name)
      }
      console.log(`armada ${cmdName}: session "${name}" already running (reattached).${attachSuffix}`)
    } else {
      if (noOpen) {
        attachSuffix = " (--no-open: skipped auto-attach)"
      } else {
        attachSuffix = await getAutoOpenSuffix(name)
      }
      // Start heartbeat on first boot when --heartbeat flag is set and tracking is enabled
      if (args.includes("--heartbeat") && !noTrack) {
        const hb = await startHeartbeat({ session: name, intervalMs: 30_000 })
        activeHeartbeats.set(name, hb)
        console.log(`started heartbeat for ${name}`)
      }
      console.log(`armada ${cmdName}: session "${name}" ready, prompt registered.${attachSuffix}`)
      if (args.includes("--heartbeat") && !noTrack) {
        console.log(`heartbeat running for "${name}" every 30s — ${cmdName} stays resident to keep the lane entry fresh. Ctrl-C to stop.`)
      }
    }
    if (cmdName === "drive") {
      process.exitCode = 1
      return 1
    }
    return 0
  } catch (err) {
    if (err instanceof DriveError) {
      console.error(err.message)
    } else {
      console.error(err?.message ?? err)
    }
    process.exitCode = 1
    return 1
  }
}

async function fleetCmd(args) {
  if (args.includes("-h") || args.includes("--help")) { console.log(HELP); return 0 }
  if (args.includes("-v") || args.includes("--version")) { process.stdout.write("armada v" + VERSION + "\n"); return 0 }
  const json = args.includes("--json")
  const open = args.includes("--open")
  const session = args.find((a) => !a.startsWith("--"))

  if (session) {
    const entry = await readRun(session)
    if (!entry) {
      console.error(`error: no run for session "${session}"`)
      process.exitCode = 1
      return 1
    }
    console.log(renderFleetDetail(entry))
    return 0
  }

  const entries = await listRuns()

  if (json) {
    console.log(renderFleetJson(entries))
    return 0
  }

  console.log(renderFleetTable(entries))

  if (open) {
    try {
      const result = await openTerminal({
        name: "armada-fleet",
        platform: process.platform,
        env: process.env,
      })
      if (!result.opened) {
        console.error(`hint: unable to open terminal — ${result.hint || "run armada fleet manually"}`)
      }
    } catch {
      console.error("hint: unable to open terminal — run armada fleet manually")
    }
  }

  return 0
}

function statusCmd(args) {
  if (args.includes("-h") || args.includes("--help")) { console.log(HELP); return 0 }
  if (args.includes("-v") || args.includes("--version")) { process.stdout.write("armada v" + VERSION + "\n"); return 0 }
  const { code, output } = statusMain(args, { cwd: process.cwd() })
  if (code === 0) {
    process.stdout.write(output)
  } else {
    process.stderr.write(output)
  }
  if (code !== 0) process.exitCode = code
  return code
}

function voyageHandoffCmd(names) {
  if (!names || names.length === 0) {
    console.error("Usage: armada voyage-handoff <name> [<name>...]")
    return 1
  }
  console.log(formatHandoffBlock(names))
  return 0
}
async function featureCmd(args) {
  if (args.includes("-h") || args.includes("--help")) { console.log(HELP); return 0 }
  if (args.includes("-v") || args.includes("--version")) { process.stdout.write("armada v" + VERSION + "\n"); return 0 }
  const targetIdx = args.indexOf("--target")
  const target = targetIdx !== -1 && args[targetIdx + 1] && !args[targetIdx + 1].startsWith("--")
    ? args[targetIdx + 1]
    : "."
  const sub = args.find((a) => !a.startsWith("--") && a !== target) || (args[0] && args[0].startsWith("--") ? undefined : args[0])
  const rest = args.filter((a) => a !== sub && a !== target && !(a.startsWith("--") && args.indexOf(a) === targetIdx))

  switch (sub) {
    case "new": {
      const name = rest.find((a) => !a.startsWith("--"))
      if (!name) {
        console.error("feature new: name is required")
        process.exitCode = 1
        return 1
      }
      const useWorktree = rest.includes("--worktree")
      const force = rest.includes("--force")
      try {
        if (useWorktree) {
          const paths = createWorktreeFeature(resolve(target), name, { force })
          console.log(`feature "${name}" created (worktree)`)
          console.log(`  worktree: ${paths.worktreePath}`)
          console.log(`  branch:   ${paths.branch}`)
          console.log(`  contract: ${paths.contractPath}`)
          console.log(`  entry:    ${paths.entryPath}`)
          console.log(`  index:    ${paths.indexPath}`)
          console.log(`  active:   ${paths.activePath}`)
        } else {
          const paths = createFeature(resolve(target), name, { force })
          console.log(`feature "${name}" created`)
          console.log(`  contract: ${paths.contractPath}`)
          console.log(`  entry:    ${paths.entryPath}`)
          console.log(`  index:    ${paths.indexPath}`)
          console.log(`  active:   ${paths.activePath}`)
        }
      } catch (err) {
        logError(err)
        process.exitCode = 1
        return 1
      }
      return 0
    }
    case "list": {
      try {
        const features = listFeatures(resolve(target))
        if (features.length === 0) {
          console.log("No features registered.")
          return 0
        }
        // Sort by name for deterministic output
        features.sort((a, b) => a.name.localeCompare(b.name))

        // Print aligned table — 5 columns: NAME STATUS CONTRACT WORKTREE BRANCH
        const nameWidth = Math.max(8, ...features.map((f) => f.name.length))
        const statusWidth = Math.max(6, ...features.map((f) => f.status.length))
        const contractWidth = Math.max(8, ...features.map((f) => f.contract.length))
        const worktreeWidth = Math.max(8, ...features.map((f) => (f.worktree || "-").length))
        const branchWidth = Math.max(6, ...features.map((f) => (f.branch || "-").length))

        const padName = "NAME".padEnd(nameWidth)
        const padStatus = "STATUS".padEnd(statusWidth)
        const padContract = "CONTRACT".padEnd(contractWidth)
        const padWorktree = "WORKTREE".padEnd(worktreeWidth)
        const padBranch = "BRANCH".padEnd(branchWidth)
        console.log(`${padName}  ${padStatus}  ${padContract}  ${padWorktree}  ${padBranch}`)
        console.log(`${"-".repeat(nameWidth)}  ${"-".repeat(statusWidth)}  ${"-".repeat(contractWidth)}  ${"-".repeat(worktreeWidth)}  ${"-".repeat(branchWidth)}`)
        for (const f of features) {
          const wt = f.worktree || "-"
          const br = f.branch || "-"
          console.log(`${f.name.padEnd(nameWidth)}  ${f.status.padEnd(statusWidth)}  ${f.contract.padEnd(contractWidth)}  ${wt.padEnd(worktreeWidth)}  ${br.padEnd(branchWidth)}`)
        }
      } catch (err) {
        logError(err)
        process.exitCode = 1
        return 1
      }
      return 0
    }
    case "close": {
      const name = rest.find((a) => !a.startsWith("--"))
      if (!name) {
        console.error("feature close: name is required")
        process.exitCode = 1
        return 1
      }
      const removeWorktree = rest.includes("--remove")
      try {
        const result = closeFeature(resolve(target), name, { removeWorktree })
        console.log(`shipped: "${name}"`)
        if (result.removedWorktree) {
          console.log(`  worktree removed: sandbox/${name}`)
        }
        console.log(`  shippedAt: ${result.entry.shippedAt}`)
      } catch (err) {
        logError(err)
        process.exitCode = 1
        return 1
      }
      return 0
    }
    case "status": {
      const name = rest[0]
      if (name) {
        console.error(`armada feature status: deprecated; use 'armada status --feature ${name}'`)
      } else {
        console.error("armada feature status: deprecated; use 'armada status --feature <name>'")
      }
      // Call status --feature <name> if a name was given
      const statusArgs = name ? ["--feature", name] : []
      const { code, output } = statusMain(statusArgs, { cwd: resolve(target) })
      if (code === 0) {
        process.stdout.write(output)
      } else {
        process.stderr.write(output)
      }
      process.exitCode = 1  // force non-zero: deprecation alias
      return 1
    }
    default:
      console.error(`Unknown feature subcommand: ${sub}`)
      console.error("Usage: armada feature new|list|close|status [name]")
      process.exitCode = 1
      return 1
  }
}
