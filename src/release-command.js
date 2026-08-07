// armada release <version> — PR-first release command.
// Pure logic module: all side effects (fs, exec, git, gh) are injected.
// NO registry publish invocation anywhere in this file.

// -- Semver helpers ----------------------------------------------------------

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/

/** Parse "X.Y.Z" into { major, minor, patch } or null. */
function parseSemver(v) {
  const m = String(v).trim().match(SEMVER_RE)
  if (!m) return null
  return { major: parseInt(m[1], 10), minor: parseInt(m[2], 10), patch: parseInt(m[3], 10) }
}

/** Compare two parsed semvers. Returns -1 (a < b), 0 (=), 1 (a > b). */
function cmpSemver(a, b) {
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1
  }
  return 0
}

/**
 * Validate a release version string.
 * Accepts valid semver X.Y.Z strictly greater than currentVersion.
 * Rejects malformed, equal, or lower versions.
 */
export function validateVersion(version, currentVersion) {
  const parsed = parseSemver(version)
  if (!parsed) {
    throw new Error(`invalid version "${version}": must be semver X.Y.Z (e.g. 1.2.3)`)
  }
  const current = parseSemver(currentVersion)
  if (!current) {
    throw new Error(`invalid current version "${currentVersion}": must be semver X.Y.Z`)
  }
  const cmp = cmpSemver(parsed, current)
  if (cmp <= 0) {
    throw new Error(
      `version "${version}" must be greater than current version "${currentVersion}"`,
    )
  }
  return { ok: true, version: parsed }
}

// -- Changelog ---------------------------------------------------------------

const CONVENTIONAL_RE = /^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert|security)(\([^)]*\))?:\s*(.+)/i

const PREFIX_SECTION = {
  feat: "Features",
  fix: "Bug Fixes",
  chore: "Chores",
  build: "Chores",
  ci: "Chores",
  style: "Chores",
  refactor: "Chores",
  perf: "Chores",
  revert: "Chores",
  docs: "Docs",
  test: "Tests",
  security: "Security",
}

const SECTION_ORDER = ["Features", "Bug Fixes", "Chores", "Docs", "Tests", "Security"]

/** Extract (prefix, description) from a conventional commit subject. */
function parseCommit(msg) {
  const m = String(msg).trim().match(CONVENTIONAL_RE)
  if (!m) return null
  return { prefix: m[1].toLowerCase(), description: m[3].trim() }
}

const DEFAULT_PREAMBLE = "# Changelog\n"

/**
 * Regenerate CHANGELOG with new section from commits.
 * Groups by conventional-commit prefix.
 * Preserves existing content above the new section.
 * Creates from preamble if currentChangelog is missing or empty.
 *
 * @param {Array<{ hash: string, subject: string }>} commits
 * @param {string} [currentChangelog] - existing CHANGELOG.md content
 * @returns {string}
 */
export function regenChangelog(commits, currentChangelog) {
  const existing = currentChangelog || ""
  const body = existing || DEFAULT_PREAMBLE

  // Find where existing version sections start (## ...)
  const firstHeading = body.search(/\n##\s/)
  const preamble = firstHeading === -1 ? body : body.slice(0, firstHeading)

  // Group commits by section.
  const groups = new Map()
  for (const c of commits) {
    const parsed = parseCommit(c.subject)
    if (!parsed) continue
    const section = PREFIX_SECTION[parsed.prefix] || "Chores"
    if (!groups.has(section)) groups.set(section, [])
    groups.get(section).push(`- ${parsed.description}`)
  }

  // Build new section.
  let newSection = ""
  for (const sec of SECTION_ORDER) {
    const items = groups.get(sec)
    if (!items || items.length === 0) continue
    newSection += `## ${sec}\n\n${items.join("\n")}\n\n`
  }

  // If no existing version sections, append new section after preamble.
  if (firstHeading === -1) {
    return preamble.trimEnd() + "\n\n" + newSection.trimEnd() + "\n"
  }

  // Insert new section between preamble and first existing version section.
  const existingSections = body.slice(firstHeading)
  return preamble.trimEnd() + "\n\n" + newSection.trimEnd() + "\n\n" + existingSections.trimStart()
}

// -- Release steps -----------------------------------------------------------

/**
 * Step 1: Bump + regen + test + commit + push + PR.
 * Dry-run: no writes, no git commit/push, no PR creation.
 * Stops before registry publish (maintainer runs that manually).
 *
 * @param {string} version - release version (X.Y.Z)
 * @param {object} opts
 * @param {boolean} [opts.dryRun]
 * @param {object} [opts.injected]
 * @returns {Promise<{ steps: string[] }>}
 */
export async function releaseStep1(version, { dryRun = false, injected = {} } = {}) {
  const inj = injected

  // Resolve current version (from injected or fallback to readFile).
  let currentVersion
  if (typeof inj.getCurrentVersion === "function") {
    currentVersion = await inj.getCurrentVersion()
  } else {
    const raw = await inj.readFile("package.json")
    currentVersion = JSON.parse(raw).version
  }

  // Validate version.
  validateVersion(version, currentVersion)

  const steps = []

  // 1. Bump package.json.
  steps.push("bump package.json")
  if (!dryRun) {
    const pkgRaw = await inj.readFile("package.json")
    const pkg = JSON.parse(pkgRaw)
    pkg.version = version
    await inj.writeFile("package.json", JSON.stringify(pkg, null, 2) + "\n")
  }

  // 2. Bump src/cli.js VERSION.
  steps.push("bump src/cli.js VERSION")
  if (!dryRun) {
    const cliSource = await inj.readFile("src/cli.js")
    const bumped = cliSource.replace(
      /^export const VERSION = "[^"]*"/m,
      `export const VERSION = "${version}"`,
    )
    if (bumped !== cliSource) {
      await inj.writeFile("src/cli.js", bumped)
    }
  }

  // 3. Get commits for changelog.
  steps.push("regen CHANGELOG")
  let commits = []
  if (typeof inj.getCommitsSince === "function") {
    commits = await inj.getCommitsSince()
  }

  // 4. Regen CHANGELOG.
  if (!dryRun) {
    let changelog = ""
    try { changelog = await inj.readFile("CHANGELOG.md") } catch { /* empty ok */ }
    const regened = regenChangelog(commits, changelog)
    await inj.writeFile("CHANGELOG.md", regened)
  }

  // 5. Regen manifest.
  steps.push("regen manifest")
  if (!dryRun) {
    const r = await inj.exec("node src/cli.js init --from-armada armada/armada.yaml --yes", {})
    if (r && r.code !== undefined && r.code !== 0) {
      throw new Error(`armada init --from-armada failed (exit ${r.code}): ${r.stderr || ""}`)
    }
  }

  // 6. Run tests.
  steps.push("run tests")
  if (!dryRun) {
    const r = await inj.exec("node --test 'tests/*.test.js'", {})
    if (r && r.code !== undefined && r.code !== 0) {
      throw new Error(`tests failed (exit ${r.code}):\n${r.stderr || ""}`)
    }
  }

  // 7. Git add + commit + push.
  steps.push("git add + commit + push")
  if (!dryRun) {
    let     r = await inj.exec('git add package.json src/cli.js CHANGELOG.md')
    if (r && r.code !== undefined && r.code !== 0) throw new Error(`git add failed: ${r.stderr || ""}`)

    r = await inj.exec(`git commit -m "chore(release): bump to v${version}"`)
    if (r && r.code !== undefined && r.code !== 0) throw new Error(`git commit failed: ${r.stderr || ""}`)

    r = await inj.exec("git push origin HEAD")
    if (r && r.code !== undefined && r.code !== 0) throw new Error(`git push failed: ${r.stderr || ""}`)
  }

  // 8. Open PR.
  steps.push("gh pr create")
  if (!dryRun) {
    const r = await inj.exec("gh pr create --base master --fill")
    if (r && r.code !== undefined && r.code !== 0) {
      throw new Error(`gh pr create failed (exit ${r.code}): ${r.stderr || ""}`)
    }
  }

  return { steps }
}

/**
 * Step 2: Regen + test + tag + push tag + gh release (post-merge).
 * Called via `armada release --continue`.
 * Stops before registry publish (maintainer runs that manually).
 *
 * @param {object} opts
 * @param {boolean} [opts.dryRun]
 * @param {object} [opts.injected]
 * @returns {Promise<{ steps: string[] }>}
 */
export async function releaseStep2({ dryRun = false, injected = {} } = {}) {
  const inj = injected

  // Resolve current version.
  let version
  if (typeof inj.getCurrentVersion === "function") {
    version = await inj.getCurrentVersion()
  } else {
    const raw = await inj.readFile("package.json")
    version = JSON.parse(raw).version
  }

  const steps = []

  // 1. Get commits for changelog.
  steps.push("regen CHANGELOG")
  let commits = []
  if (typeof inj.getCommitsSince === "function") {
    commits = await inj.getCommitsSince()
  }

  // 2. Regen CHANGELOG.
  if (!dryRun) {
    let changelog = ""
    try { changelog = await inj.readFile("CHANGELOG.md") } catch { /* empty ok */ }
    const regened = regenChangelog(commits, changelog)
    await inj.writeFile("CHANGELOG.md", regened)
  }

  // 3. Regen manifest.
  steps.push("regen manifest")
  if (!dryRun) {
    const r = await inj.exec("node src/cli.js init --from-armada armada/armada.yaml --yes", {})
    if (r && r.code !== undefined && r.code !== 0) {
      throw new Error(`armada init --from-armada failed (exit ${r.code}): ${r.stderr || ""}`)
    }
  }

  // 4. Run tests.
  steps.push("run tests")
  if (!dryRun) {
    const r = await inj.exec("node --test 'tests/*.test.js'", {})
    if (r && r.code !== undefined && r.code !== 0) {
      throw new Error(`tests failed (exit ${r.code}):\n${r.stderr || ""}`)
    }
  }

  // 5. Git tag + push tag.
  steps.push("git tag + push")
  if (!dryRun) {
    let r = await inj.exec(`git tag v${version}`)
    if (r && r.code !== undefined && r.code !== 0) throw new Error(`git tag failed: ${r.stderr || ""}`)

    r = await inj.exec(`git push origin v${version}`)
    if (r && r.code !== undefined && r.code !== 0) throw new Error(`git push tag failed: ${r.stderr || ""}`)
  }

  // 6. gh release create.
  steps.push("gh release create")
  if (!dryRun) {
    const r = await inj.exec(`gh release create v${version} --title "v${version}" --notes-file CHANGELOG.md`)
    if (r && r.code !== undefined && r.code !== 0) {
      throw new Error(`gh release create failed (exit ${r.code}): ${r.stderr || ""}`)
    }
  }

  // STOP-LINE: registry publish is never invoked. The maintainer runs it manually.
  return { steps }
}

// -- Production injection (real I/O for CLI path) ----------------------------

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { execSync } from "node:child_process"

export const productionInjection = {
  async readFile(path) {
    return readFileSync(path, "utf8")
  },
  async writeFile(path, content) {
    writeFileSync(path, content, "utf8")
  },
  exists(path) {
    return existsSync(path)
  },
  async exec(command, _opts) {
    try {
      const stdout = execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      return { stdout, stderr: "", code: 0 }
    } catch (err) {
      return {
        stdout: err.stdout || "",
        stderr: err.stderr || err.message || "",
        code: err.status ?? 1,
      }
    }
  },
  async getCurrentVersion() {
    const raw = readFileSync("package.json", "utf8")
    return JSON.parse(raw).version
  },
  async getCommitsSince() {
    try {
      const stdout = execSync(
        'git log --oneline --no-decorate $(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~100)..HEAD --format="%h %s"',
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      )
      return stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const space = line.indexOf(" ")
          return {
            hash: space === -1 ? line : line.slice(0, space),
            subject: space === -1 ? "" : line.slice(space + 1),
          }
        })
    } catch {
      return []
    }
  },
}
