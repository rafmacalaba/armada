#!/usr/bin/env node
// opencode-armada CLI — entry point.
//
// Commands:
//   armada init                 interactive questionnaire -> writes team config
//   armada init --stack ...     declarative flags
//   armada init --from-armada armada/armada.yaml   re-scaffold from manifest
//   armada models [budget]      print curated model catalog
//   armada models --refresh     merge live provider models (requires auth)
//   armada doctor               check providers + env + background dispatch
//   armada uninstall [--all]    remove armada-generated artifacts (--all also user-facing)
//   armada ping                 confirm the CLI works
//   armada help                 this help

import { existsSync, readFileSync, realpathSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { runQuestionnaire, guessName } from "./questionnaire.js"
import { detectStack } from "./stack-detect.js"
import { scaffold, uninstall } from "./scaffold.js"
import { renderCatalog, BUDGETS, ROLES, modelFor, refreshModels, loadModelsCache } from "./model-catalog.js"
import { parseManifestYaml, validateRequirementsFile } from "./manifest.js"
import { runDoctor } from "./doctor.js"
import { runNew } from "./new-command.js"

export const VERSION = "0.6.1"

const HELP = `opencode-armada v${VERSION}
Evidence-gated AI-engineer teams for opencode, natively (no plugin).

Usage:
  armada init                                interactive setup
  armada new <name> [--type <c>] [--beginner|--experienced] [--yes]
                          create new project from curated starter template
  armada init --stack <s> --budget <b>       declarative setup
  armada init --headless                     CI-safe: orchestrator bash allowed (opencode run)
  armada init --requirements <file>          per-feature contract file (default armada/REQUIREMENTS.md)
  armada init --target <dir>                 scaffold into a directory (default cwd)
  armada init --from-armada armada/armada.yaml      regenerate from manifest
  armada models [budget]                     show curated model catalog
  armada models --refresh                    merge live provider models
  armada doctor                              environment health check
  armada uninstall [--all] [--dry-run] [--target <dir>]  remove armada-generated artifacts
  armada ping                                sanity check
  armada help                                this help
`

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
      return doctor()
    case "uninstall":
      return uninstallCmd(rest)
    case "ping":
      console.log("armada ok")
      return 0
    case "new": {
      const name = rest[0]
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

if (isMain) {
  main().catch((err) => {
    logError(err, `check permissions on the target directory`)
    process.exitCode = 1
  })
}

async function init(args) {
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
  if (budgetIdx !== -1 && BUDGETS.includes(args[budgetIdx + 1])) {
    manifest.project.budget = args[budgetIdx + 1]
  }
  const noBrowser = args.includes("--no-browser")
  if (noBrowser) {
    manifest.project.browserTesting = false
    manifest.project.useAgentBrowser = false
  }
  if (args.includes("--headless")) {
    manifest.project.headless = true
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
  }

  // Always detect the stack from the repo, then overlay any --stack hint onto
  // the detected fields. Stored back into the manifest so armada.yaml reflects it.
  const stack = applyStackHint(
    Object.keys(manifest.project.stack).length ? { ...manifest.project.stack } : detectStack(manifest.targetDir ?? "."),
    stackHint(args))

  manifest.project.stack = stack

  const dryRun = args.includes("--dry-run")
  let files
  try {
    files = scaffold(manifest, stack, { dryRun })
  } catch (err) {
    logError(err, `check permissions on the target directory`)
    process.exitCode = 1
    return 1
  }
  console.log(`\n${dryRun ? "(dry-run) " : ""}Scaffolded opencode-armada team:`)
  for (const f of files) console.log(`  ${dryRun ? "(dry-run) + " : "+ "}${f}`)
  console.log("\nNext:")
  console.log("  1. opencode")
  console.log("  2. /armada  -> team status")
  console.log("  3. 'ping all agents'  -> verify roster")
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
  const refresh = args.includes("--refresh")
  const budget = args.find((a) => BUDGETS.includes(a)) ?? "balanced"
  const cacheIdx = args.indexOf("--cache")
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

async function doctor() {
  console.log("opencode-armada doctor")
  const checks = await runDoctor()
  let anyFail = false
  for (const { name, status, detail } of checks) {
    console.log(`${name}: ${status} — ${detail}`)
    if (status === "fail") anyFail = true
  }
  if (anyFail) process.exitCode = 1
  return anyFail ? 1 : 0
}

async function uninstallCmd(args) {
  const targetIdx = args.indexOf("--target")
  const target = targetIdx !== -1 && args[targetIdx + 1] && !args[targetIdx + 1].startsWith("--") ? args[targetIdx + 1] : "."
  const fileIdx = args.indexOf("--from-armada")
  const file = fileIdx !== -1 ? args[fileIdx + 1] : "armada/armada.yaml"
  const dryRun = args.includes("--dry-run")
  const all = args.includes("--all")
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
    removed = uninstall(manifest, { all, dryRun })
  } catch (err) {
    logError(err, `check permissions on the target directory`)
    process.exitCode = 1
    return 1
  }
  console.log(`\n${dryRun ? "(dry-run) " : ""}Removed armada artifacts:`)
  for (const f of removed) console.log(`  ${dryRun ? "(dry-run) - " : "- "}${f}`)
  return 0
}
