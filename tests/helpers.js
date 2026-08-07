import { mkdtempSync, writeFileSync, mkdirSync, chmodSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFile, spawnSync, spawn } from "node:child_process"
import YAML from "yaml"

const CLI = join(process.cwd(), "src/cli.js")

export function makeTempRepo(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "armada-e2e-"))
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel)
    mkdirSync(join(dir, rel.split("/").slice(0, -1).join("/")), { recursive: true })
    writeFileSync(p, content, "utf8")
  }
  return dir
}

/**
 * Create a temp repo with git initialized and an initial commit.
 * Calls makeTempRepo for the base, then runs git init/commit.
 * @param {{ [relPath: string]: string }} [files]
 * @returns {string} dir
 */
export function makeTempGitRepo(files = {}) {
  const dir = makeTempRepo(files)
  const opts = { cwd: dir, encoding: "utf8" }
  spawnSync("git", ["init", "-b", "main"], opts)
  spawnSync("git", ["config", "user.email", "t@t"], opts)
  spawnSync("git", ["config", "user.name", "t"], opts)
  spawnSync("git", ["add", "-A"], opts)
  spawnSync("git", ["commit", "-m", "init"], opts)
  return dir
}

export function makeBin(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "armada-bin-"))
  for (const [name, content] of Object.entries(files)) {
    const p = join(dir, name)
    writeFileSync(p, content, "utf8")
    chmodSync(p, 0o755)
  }
  return dir
}

export function runCli(args, opts = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env, ...(opts.env || {}) }
    execFile(process.execPath, [CLI, ...args], { cwd: opts.cwd || process.cwd(), env },
      (err, stdout, stderr) => resolve({ code: err?.code ?? 0, stdout, stderr }))
  })
}

/**
 * Convert an opencode permission glob into a match test against a path.
 * Standalone "*" is the catch-all (matches across "/"); an embedded "*"
 * matches a single path segment ("[^/]*"). Everything else is literal.
 */
function globMatches(glob, path) {
  if (glob === "*") return true
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")
  return new RegExp("^" + escaped + "$").test(path)
}

/**
 * Specificity score for a glob: [literalSegmentCount, segmentCount, length].
 * Higher tuple = more specific. Literal paths beat globs; more segments beat
 * fewer; longer patterns break ties. This mirrors the opencode SDK's
 * most-specific-rule-wins resolution.
 */
function specificity(glob) {
  const segments = glob.split("/")
  const literalSegments = segments.filter((s) => !s.includes("*")).length
  return [literalSegments, segments.length, glob.length]
}

/**
 * Resolve an opencode edit-permission matrix against a file path.
 * Mirrors SDK resolution: the most specific matching pattern wins; "*" is the
 * catch-all fallback. Returns "allow" | "deny" | "ask" (or undefined if no
 * pattern matches at all, which should not happen when "*" is present).
 * @param {Record<string, string>} edit  role edit map { glob -> permission }
 * @param {string} path                  absolute or relative file path
 * @returns {string|undefined}
 */
export function resolvePermission(edit, path) {
  const entries = Object.entries(edit)
  const matched = entries
    .filter(([glob]) => globMatches(glob, path))
    .sort((a, b) => {
      const sa = specificity(a[0])
      const sb = specificity(b[0])
      // compare tuples descending
      for (let i = 0; i < sa.length; i++) {
        if (sa[i] !== sb[i]) return sb[i] - sa[i]
      }
      return 0
    })
  return matched.length ? matched[0][1] : undefined
}

export function parseFrontmatter(frontmatterYaml) {
  return YAML.parse(frontmatterYaml)
}

/**
 * Run the CLI in a spawned child process with custom stdio.
 * Use for testing non-TTY behavior where execFile's stdio inheritance
 * would give misleading isTTY results.
 * @param {string[]} args
 * @param {{ cwd?: string, env?: Record<string,string>, stdio?: any[] }} [opts]
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
export function spawnCli(args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd: opts.cwd || process.cwd(),
      env: { ...process.env, ...(opts.env || {}) },
      stdio: opts.stdio || ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    if (child.stdout) child.stdout.on('data', (d) => { stdout += d.toString() })
    if (child.stderr) child.stderr.on('data', (d) => { stderr += d.toString() })
    // Close stdin immediately so the close event fires after child exits.
    if (child.stdin) child.stdin.end()
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }))
  })
}
