import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))

const SCRIPT_PATH = join(__dirname, "..", "scripts", "untrack-process-artifacts.sh")
const GITIGNORE_PATH = join(__dirname, "..", ".gitignore")
const DOCS_PATH = join(__dirname, "..", "docs", "process-artifacts.md")

// All target files the script must mention
const TARGET_FILES = [
  "DEFECTS.md",
  "ADVERSARIAL_REVIEW.md",
  "AUDIT.md",
]

// --- Script tests ---

test("scripts/untrack-process-artifacts.sh exists", () => {
  assert.ok(existsSync(SCRIPT_PATH), "script should exist at scripts/untrack-process-artifacts.sh")
})

test("scripts/untrack-process-artifacts.sh is executable", () => {
  const st = statSync(SCRIPT_PATH)
  const mode = st.mode & 0o111
  assert.ok(mode !== 0, "script should have at least one executable bit")
})

test("script source mentions each target file path", () => {
  const src = readFileSync(SCRIPT_PATH, "utf8")
  for (const f of TARGET_FILES) {
    assert.ok(src.includes(f), `script source should contain "${f}"`)
  }
})

test("script source has git rm --cached command", () => {
  const src = readFileSync(SCRIPT_PATH, "utf8")
  assert.ok(src.includes("git rm --cached"), "script should reference git rm --cached")
})

test("script source has idempotency guard", () => {
  const src = readFileSync(SCRIPT_PATH, "utf8")
  assert.ok(src.includes("--error-unmatch"), "script should guard with git ls-files --error-unmatch")
  assert.ok(src.includes("Already untracked") || src.includes("skip"),
    "script should print skip message for already-untracked files")
})

test("script has shebang", () => {
  const src = readFileSync(SCRIPT_PATH, "utf8")
  assert.ok(src.startsWith("#!/"), "script should start with shebang")
})

// --- .gitignore process block tests ---

test(".gitignore has armada:process marker block", () => {
  const content = readFileSync(GITIGNORE_PATH, "utf8")
  assert.ok(content.includes("# armada:process"), ".gitignore should have # armada:process marker")
  assert.ok(content.includes("# armada:process:end"), ".gitignore should have # armada:process:end marker")
})

test(".gitignore process block ignores each target path", () => {
  const content = readFileSync(GITIGNORE_PATH, "utf8")
  assert.ok(content.includes("/DEFECTS.md"), ".gitignore should ignore /DEFECTS.md")
  assert.ok(content.includes("/ADVERSARIAL_REVIEW.md"), ".gitignore should ignore /ADVERSARIAL_REVIEW.md")
  assert.ok(content.includes("/AUDIT.md"), ".gitignore should ignore /AUDIT.md")
})

test(".gitignore process block is below armada block", () => {
  const content = readFileSync(GITIGNORE_PATH, "utf8")
  const armadaEndIdx = content.indexOf("/opencode.json")
  const processStartIdx = content.indexOf("# armada:process")
  assert.ok(armadaEndIdx < processStartIdx,
    "process block should appear after armada entries in .gitignore")
})

test(".gitignore armada entries still present", () => {
  const content = readFileSync(GITIGNORE_PATH, "utf8")
  assert.ok(content.includes("/armada/"), ".gitignore should keep /armada/ entry")
  assert.ok(content.includes("/.opencode/"), ".gitignore should keep /.opencode/ entry")
  assert.ok(content.includes("/opencode.json"), ".gitignore should keep /opencode.json entry")
})

// --- docs ---

test("docs/process-artifacts.md exists", () => {
  assert.ok(existsSync(DOCS_PATH), "docs/process-artifacts.md should exist")
})

test("docs/process-artifacts.md references the script", () => {
  const content = readFileSync(DOCS_PATH, "utf8")
  assert.ok(content.includes("untrack-process-artifacts.sh"),
    "docs should reference the untrack script")
})

test("docs/process-artifacts.md lists target files", () => {
  const content = readFileSync(DOCS_PATH, "utf8")
  assert.ok(content.includes("DEFECTS.md"), "docs should mention DEFECTS.md")
  assert.ok(content.includes("ADVERSARIAL_REVIEW.md"), "docs should mention ADVERSARIAL_REVIEW.md")
  assert.ok(content.includes("AUDIT.md"), "docs should mention AUDIT.md")
})

// --- DEF-034: e2e -> tests migration ---

test("DEF-034: cli-wiring.test.js in tests/", () => {
  const p = join(__dirname, "cli-wiring.test.js")
  assert.ok(existsSync(p), "tests/cli-wiring.test.js must exist")
})

test("DEF-034: e2e directory has no test files", () => {
  const e2eDir = join(__dirname, "..", "e2e")
  if (!existsSync(e2eDir)) return
  const entries = readdirSync(e2eDir)
  const testFiles = entries.filter(f => f.endsWith(".test.js"))
  assert.strictEqual(testFiles.length, 0, `e2e/ should have no .test.js files, found: ${testFiles.join(", ")}`)
})

test("DEF-034: git ls-files shows migration targets in tests/", () => {
  const result = spawnSync("git", ["ls-files", "tests/cli-wiring.test.js", "tests/reconcile-cli.test.js", "tests/validation.test.js", "tests/armada-resume-command.test.js", "tests/armada-resume-roundtrip.test.js"], { encoding: "utf8", cwd: join(__dirname, "..") })
  const lines = result.stdout.trim().split("\n").filter(Boolean)
  assert.strictEqual(lines.length, 5, `expected 5 files tracked in tests/, got ${lines.length}: ${result.stdout}`)
})

test("DEF-034: git ls-files shows nothing from e2e/", () => {
  const result = spawnSync("git", ["ls-files", "e2e/"], { encoding: "utf8", cwd: join(__dirname, "..") })
  assert.strictEqual(result.stdout.trim(), "", `e2e/ should have no tracked files, got: ${result.stdout}`)
})

// --- DEF-035: untrack script works from subdirectory ---

test("DEF-035: untrack script works from subdirectory", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "armada-def035-"))
  try {
    // init git repo
    spawnSync("git", ["init", "-b", "main"], { cwd: repoRoot, encoding: "utf8" })
    spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: repoRoot, encoding: "utf8" })
    spawnSync("git", ["config", "user.name", "Tester"], { cwd: repoRoot, encoding: "utf8" })

    // create and commit a file that the script targets
    writeFileSync(join(repoRoot, "DEFECTS.md"), "# defect ledger\n", "utf8")
    spawnSync("git", ["add", "DEFECTS.md"], { cwd: repoRoot, encoding: "utf8" })
    spawnSync("git", ["commit", "-m", "init"], { cwd: repoRoot, encoding: "utf8" })

    // verify file is tracked
    let tracked = spawnSync("git", ["ls-files", "DEFECTS.md"], { cwd: repoRoot, encoding: "utf8" })
    assert.ok(tracked.stdout.includes("DEFECTS.md"), "DEFECTS.md must be tracked before script run")

    // create a subdirectory and run script from it
    const subDir = join(repoRoot, "deeply", "nested", "sub")
    mkdirSync(subDir, { recursive: true })

    const result = spawnSync("bash", [SCRIPT_PATH], { cwd: subDir, encoding: "utf8" })
    assert.strictEqual(result.status, 0, `script failed: ${result.stderr}`)

    // verify file is no longer tracked
    tracked = spawnSync("git", ["ls-files", "DEFECTS.md"], { cwd: repoRoot, encoding: "utf8" })
    assert.strictEqual(tracked.stdout.trim(), "", `DEFECTS.md should be untracked after script, but found in: ${tracked.stdout}`)
  } finally {
    rmSync(repoRoot, { recursive: true, force: true })
  }
})
