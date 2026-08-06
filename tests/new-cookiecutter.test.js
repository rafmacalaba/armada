import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execSync } from "node:child_process"
import { runNew } from "../src/new-command.js"
import { runCli, makeTempRepo } from "./helpers.js"

test("runNew --template <local-path> copies, substitutes, and excludes .git", async () => {
  const tmp = join(tmpdir(), "armada-cc-test-" + Date.now())
  const templateDir = join(tmp, "template")
  const targetDir = join(tmp, "my-output")

  mkdirSync(templateDir, { recursive: true })
  writeFileSync(join(templateDir, "README.md"), "# {{ cookiecutter.project_name }}\n{{ cookiecutter.description }}", "utf8")
  writeFileSync(join(templateDir, "src"), "console.log('{{ cookiecutter.project_name }}')", "utf8")
  mkdirSync(join(templateDir, ".git"))
  writeFileSync(join(templateDir, ".git", "config"), "[core]", "utf8")

  writeFileSync(join(tmp, "vars.json"), JSON.stringify({ project_name: "my-test-app", description: "A test project" }), "utf8")

  const code = await runNew({
    name: "my-output",
    template: templateDir,
    config: join(tmp, "vars.json"),
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 0)
  assert.strictEqual(existsSync(targetDir), true)
  const readme = readFileSync(join(targetDir, "README.md"), "utf8")
  assert.match(readme, /# my-test-app/)
  assert.match(readme, /A test project/)
  const src = readFileSync(join(targetDir, "src"), "utf8")
  assert.match(src, /console\.log\('my-test-app'\)/)
  // .git excluded
  assert.strictEqual(existsSync(join(targetDir, ".git")), false)
  rmSync(tmp, { recursive: true, force: true })
})

test("runNew --template reads config JSON or falls back to COOKIECUTTER_ env vars", async () => {
  // --config JSON file takes precedence over env vars
  let tmp = join(tmpdir(), "armada-cc-test2-" + Date.now())
  let templateDir = join(tmp, "template")
  mkdirSync(templateDir, { recursive: true })
  writeFileSync(join(templateDir, "README.md"), "# {{ cookiecutter.project_name }}\nAuthor: {{ cookiecutter.author }}", "utf8")
  writeFileSync(join(tmp, "vars.json"), JSON.stringify({ project_name: "my-test-app", author: "dev" }), "utf8")
  const prev1 = process.env.COOKIECUTTER_PROJECT_NAME
  process.env.COOKIECUTTER_PROJECT_NAME = "should-not-use"
  let code = await runNew({ name: "my-project", template: templateDir, config: join(tmp, "vars.json"), yes: true, cwd: tmp })
  if (prev1 === undefined) delete process.env.COOKIECUTTER_PROJECT_NAME
  else process.env.COOKIECUTTER_PROJECT_NAME = prev1
  assert.strictEqual(code, 0)
  assert.strictEqual(existsSync(join(tmp, "my-project")), true)
  let readme = readFileSync(join(tmp, "my-project", "README.md"), "utf8")
  assert.match(readme, /# my-test-app/)
  assert.match(readme, /Author: dev/)
  rmSync(tmp, { recursive: true, force: true })

  // COOKIECUTTER_ env vars used when no config
  tmp = join(tmpdir(), "armada-cc-test3-" + Date.now())
  templateDir = join(tmp, "template")
  mkdirSync(templateDir, { recursive: true })
  writeFileSync(join(templateDir, "README.md"), "# {{ cookiecutter.foo }}", "utf8")
  const prev2 = process.env.COOKIECUTTER_FOO
  process.env.COOKIECUTTER_FOO = "env-value"
  code = await runNew({ name: "my-env-project", template: templateDir, yes: true, cwd: tmp })
  if (prev2 === undefined) delete process.env.COOKIECUTTER_FOO
  else process.env.COOKIECUTTER_FOO = prev2
  assert.strictEqual(code, 0)
  assert.strictEqual(existsSync(join(tmp, "my-env-project")), true)
  readme = readFileSync(join(tmp, "my-env-project", "README.md"), "utf8")
  assert.match(readme, /# env-value/)
  rmSync(tmp, { recursive: true, force: true })
})

test("rejects '..' in project name for path traversal", async () => {
  const r = await runCli(["new", ".."])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /\.\./)
})

test("--type flag prints clear error message (removed)", async () => {
  const r = await runCli(["new", "my-app", "--type", "web-app"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /--type.*removed|--template/)
})

test("runNew without template (non-interactive) defaults to blank template and succeeds", async () => {
  const tmp = join(tmpdir(), "armada-cc-test4-" + Date.now())
  mkdirSync(tmp, { recursive: true })

  const code = await runNew({
    name: "no-template",
    yes: true,
    cwd: tmp,
  })

  // Should now succeed (code 0) — defaults to blank template
  assert.strictEqual(code, 0)
  const targetDir = join(tmp, "no-template")
  assert.strictEqual(existsSync(targetDir), true)
  assert.strictEqual(existsSync(join(targetDir, "armada", "armada.yaml")), true)

  rmSync(tmp, { recursive: true, force: true })
})

test("DEF-007/DEF-014: malicious variable values in JSON files are safely escaped", async () => {
  const tmp = join(tmpdir(), "armada-def014-" + Date.now())
  mkdirSync(tmp, { recursive: true })

  // Template with package.json that uses description variable
  const templateDir = join(tmp, "template")
  mkdirSync(templateDir, { recursive: true })
  writeFileSync(join(templateDir, "package.json"),
    '{"name":"{{ cookiecutter.project_name }}","description":"{{ cookiecutter.description }}"}\n', "utf8")

  // SEC-006 attack: JSON-valid injection bypasses post-render parse check
  writeFileSync(join(tmp, "vars.json"), JSON.stringify({
    project_name: "test-app",
    description: '", "scripts": {"preinstall": "echo PWNED"}, "private": "", "dummy": "'
  }), "utf8")

  const code = await runNew({
    name: "def014-app",
    template: templateDir,
    config: join(tmp, "vars.json"),
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 0, `expected code 0, got ${code}`)
  process.exitCode = 0

  // Rendered package.json must be valid JSON
  const pkgPath = join(tmp, "def014-app", "package.json")
  assert.strictEqual(existsSync(pkgPath), true, "package.json should exist")
  let parsed
  assert.doesNotThrow(() => { parsed = JSON.parse(readFileSync(pkgPath, "utf8")) }, "rendered package.json should be valid JSON")

  // No injected scripts key — the attack value is confined to the description string
  assert.strictEqual(parsed.scripts, undefined, "no injected scripts key")
  assert.strictEqual(parsed.private, undefined, "no injected private key")
  assert.strictEqual(parsed.name, "test-app", "name should be preserved")
  assert.ok(typeof parsed.description === "string", "description should be a string")
  assert.match(parsed.description, /scripts/, "description string should contain the escaped attack text")

  rmSync(tmp, { recursive: true, force: true })
})

test("DEF-008: template symlinks are not followed during render", async () => {
  const tmp = join(tmpdir(), "armada-def008-" + Date.now())
  mkdirSync(tmp, { recursive: true })

  // Create a template with a symlink to a sensitive file
  const templateDir = join(tmp, "template")
  mkdirSync(templateDir, { recursive: true })
  writeFileSync(join(templateDir, "README.md"), "# {{ cookiecutter.project_name }}", "utf8")

  // Create a secret file outside the template
  const secretPath = join(tmp, "secret.txt")
  writeFileSync(secretPath, "SUPER-SECRET", "utf8")

  // Symlink inside template
  const { symlinkSync } = await import("node:fs")
  symlinkSync(secretPath, join(templateDir, "leaked.txt"))

  writeFileSync(join(tmp, "vars.json"), JSON.stringify({ project_name: "test-sym" }), "utf8")

  const code = await runNew({
    name: "def008-app",
    template: templateDir,
    config: join(tmp, "vars.json"),
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 0, `expected code 0, got ${code}`)
  // leaked.txt should NOT be created in output
  const leakedPath = join(tmp, "def008-app", "leaked.txt")
  assert.strictEqual(existsSync(leakedPath), false, "symlink should not be followed/copied")

  rmSync(tmp, { recursive: true, force: true })
})

test("DEF-015: HTML-escape substitution in Markdown and HTML files", async () => {
  const tmp = join(tmpdir(), "armada-def015-" + Date.now())
  mkdirSync(tmp, { recursive: true })

  const templateDir = join(tmp, "template")
  mkdirSync(templateDir, { recursive: true })
  writeFileSync(join(templateDir, "README.md"), "# {{ cookiecutter.project_name }}\n\n{{ cookiecutter.description }}\n", "utf8")
  writeFileSync(join(templateDir, "index.html"), '<!DOCTYPE html>\n<title>{{ cookiecutter.description }}</title>\n', "utf8")

  writeFileSync(join(tmp, "vars.json"), JSON.stringify({
    project_name: "safe-app",
    description: '<script>alert(1)</script>'
  }), "utf8")

  const code = await runNew({
    name: "def015-app",
    template: templateDir,
    config: join(tmp, "vars.json"),
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 0, `expected code 0, got ${code}`)
  process.exitCode = 0

  // README.md: must have HTML-escaped script tag
  const readme = readFileSync(join(tmp, "def015-app", "README.md"), "utf8")
  assert.ok(!/<script>/i.test(readme), "README.md must not contain raw <script>")
  assert.match(readme, /&lt;script&gt;/, "README.md should have HTML-escaped script tag")

  // index.html: should have HTML-escaped script tag
  const html = readFileSync(join(tmp, "def015-app", "index.html"), "utf8")
  assert.ok(!/<script>/i.test(html), "index.html must not contain raw <script>")
  assert.match(html, /&lt;script&gt;/, "index.html should have HTML-escaped script tag")

  rmSync(tmp, { recursive: true, force: true })
})

test("DEF-012: 500-character project name rejected with length error", async () => {
  const tmp = join(tmpdir(), "armada-def012-" + Date.now())
  mkdirSync(tmp, { recursive: true })

  const longName = "a".repeat(500)

  const code = await runNew({
    name: longName,
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 1, `expected code 1 for 500-char name, got ${code}`)
  process.exitCode = 0
  rmSync(tmp, { recursive: true, force: true })
})

test("DEF-009: --template with a file path errors with 'not a directory'", async () => {
  const tmp = join(tmpdir(), "armada-def009-" + Date.now())
  mkdirSync(tmp, { recursive: true })

  // Create a regular file, not a directory
  const filePath = join(tmp, "not-a-dir.txt")
  writeFileSync(filePath, "hello", "utf8")

  const code = await runNew({
    name: "def009-app",
    template: filePath,
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 1, `expected code 1, got ${code}`)
  process.exitCode = 0
  rmSync(tmp, { recursive: true, force: true })
})

test("DEF-011: cloneTemplate temp dir cleaned on error path", async () => {
  const tmp = join(tmpdir(), "armada-def011-" + Date.now())
  mkdirSync(tmp, { recursive: true })

  // Create a local git repo to serve as template
  const repoDir = join(tmp, "repo")
  mkdirSync(repoDir, { recursive: true })
  writeFileSync(join(repoDir, "README.md"), "# {{ cookiecutter.project_name }}", "utf8")
  execSync("git init -b main", { cwd: repoDir, stdio: "pipe" })
  execSync("git config user.email t@t", { cwd: repoDir, stdio: "pipe" })
  execSync("git config user.name t", { cwd: repoDir, stdio: "pipe" })
  execSync("git add -A && git commit -m init", { cwd: repoDir, stdio: "pipe" })

  // Use file:// URL to trigger cloneTemplate
  const repoUrl = "file://" + repoDir

  // Snapshot tmpdir before test
  const before = new Set(readdirSync(tmpdir()))

  // Bad config causes resolveVariables to return null (error path)
  const code = await runNew({
    name: "def011-app",
    template: repoUrl,
    config: "/nonexistent/config.json",
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 1, `expected code 1, got ${code}`)
  process.exitCode = 0

  // Verify no new armada-cc-* temp dir leaked
  const after = readdirSync(tmpdir())
  const leaked = after.filter((e) => e.startsWith("armada-cc-") && !before.has(e))
  assert.strictEqual(leaked.length, 0, `temp dir leaked: ${leaked.join(", ")}`)

  rmSync(tmp, { recursive: true, force: true })
})
