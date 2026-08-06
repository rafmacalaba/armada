import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execSync } from "node:child_process"
import { runNew } from "../src/new-command.js"
import { runCli, makeTempRepo } from "./helpers.js"

test("runNew --template <local-path> copies and substitutes cookiecutter vars", async () => {
  const tmp = join(tmpdir(), "armada-cc-test-" + Date.now())
  const templateDir = join(tmp, "template")
  const targetDir = join(tmp, "my-output")

  // Create a tiny template with cookiecutter placeholders
  mkdirSync(templateDir, { recursive: true })
  writeFileSync(join(templateDir, "README.md"), "# {{ cookiecutter.project_name }}\n{{ cookiecutter.description }}", "utf8")
  writeFileSync(join(templateDir, "src"), "console.log('{{ cookiecutter.project_name }}')", "utf8")
  mkdirSync(join(templateDir, ".git"))
  writeFileSync(join(templateDir, ".git", "config"), "[core]", "utf8")

  // Config file provides variables
  writeFileSync(join(tmp, "vars.json"), JSON.stringify({ project_name: "my-test-app", description: "A test project" }), "utf8")

  const code = await runNew({
    name: "my-output",
    template: templateDir,
    config: join(tmp, "vars.json"),
    yes: true,
    cwd: tmp,
  })

  // Should exit successfully
  assert.strictEqual(code, 0)

  // Config file provides variables, so use those
  assert.strictEqual(existsSync(targetDir), true)
  const readme = readFileSync(join(targetDir, "README.md"), "utf8")
  assert.match(readme, /# my-test-app/)
  assert.match(readme, /A test project/)

  const src = readFileSync(join(targetDir, "src"), "utf8")
  assert.match(src, /console\.log\('my-test-app'\)/)

  // .git should be excluded
  assert.strictEqual(existsSync(join(targetDir, ".git")), false)
})

test("runNew --template <local-path> reads config from --config JSON file", async () => {
  const tmp = join(tmpdir(), "armada-cc-test2-" + Date.now())
  const templateDir = join(tmp, "template")
  const targetDir = join(tmp, "my-project")

  mkdirSync(templateDir, { recursive: true })
  writeFileSync(join(templateDir, "README.md"), "# {{ cookiecutter.project_name }}\nAuthor: {{ cookiecutter.author }}", "utf8")

  // Write config JSON
  writeFileSync(join(tmp, "vars.json"), JSON.stringify({ project_name: "my-test-app", author: "dev" }), "utf8")

  // Also set env var that should be ignored when --config is present
  const prev = process.env.COOKIECUTTER_PROJECT_NAME
  process.env.COOKIECUTTER_PROJECT_NAME = "should-not-use"

  const code = await runNew({
    name: "my-project",
    template: templateDir,
    config: join(tmp, "vars.json"),
    yes: true,
    cwd: tmp,
  })

  if (prev === undefined) delete process.env.COOKIECUTTER_PROJECT_NAME
  else process.env.COOKIECUTTER_PROJECT_NAME = prev

  assert.strictEqual(code, 0)
  assert.strictEqual(existsSync(targetDir), true)

  const readme = readFileSync(join(targetDir, "README.md"), "utf8")
  assert.match(readme, /# my-test-app/)
  assert.match(readme, /Author: dev/)
})

test("runNew --template <local-path> uses COOKIECUTTER_ env vars when no config", async () => {
  const tmp = join(tmpdir(), "armada-cc-test3-" + Date.now())
  const templateDir = join(tmp, "template")
  const targetDir = join(tmp, "my-env-project")

  mkdirSync(templateDir, { recursive: true })
  writeFileSync(join(templateDir, "README.md"), "# {{ cookiecutter.foo }}", "utf8")

  const prev = process.env.COOKIECUTTER_FOO
  process.env.COOKIECUTTER_FOO = "env-value"

  const code = await runNew({
    name: "my-env-project",
    template: templateDir,
    yes: true,
    cwd: tmp,
  })

  if (prev === undefined) delete process.env.COOKIECUTTER_FOO
  else process.env.COOKIECUTTER_FOO = prev

  assert.strictEqual(code, 0)
  assert.strictEqual(existsSync(targetDir), true)

  const readme = readFileSync(join(targetDir, "README.md"), "utf8")
  assert.match(readme, /# env-value/)
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
})

test("runNew skips .git directory in template", async () => {
  const tmp = join(tmpdir(), "armada-cc-test7-" + Date.now())
  const templateDir = join(tmp, "template")
  const targetDir = join(tmp, "hello")

  mkdirSync(templateDir, { recursive: true })
  writeFileSync(join(templateDir, "app.js"), "// {{ cookiecutter.app_name }}", "utf8")
  mkdirSync(join(templateDir, ".git"))
  writeFileSync(join(templateDir, ".git", "HEAD"), "ref: refs/heads/main", "utf8")

  writeFileSync(join(tmp, "vars.json"), JSON.stringify({ app_name: "myapp" }), "utf8")

  const code = await runNew({
    name: "hello",
    template: templateDir,
    config: join(tmp, "vars.json"),
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 0)
  assert.strictEqual(existsSync(targetDir), true)
  assert.strictEqual(existsSync(join(targetDir, ".git")), false)
})

test("DEF-007: malicious variable values that break JSON are rejected", async () => {
  const tmp = join(tmpdir(), "armada-def007-" + Date.now())
  mkdirSync(tmp, { recursive: true })

  // Template with package.json that uses description variable
  const templateDir = join(tmp, "template")
  mkdirSync(templateDir, { recursive: true })
  writeFileSync(join(templateDir, "package.json"),
    '{"name":"{{ cookiecutter.project_name }}","description":"{{ cookiecutter.description }}"}\n', "utf8")

  // Malicious config: description value injects JSON
  writeFileSync(join(tmp, "vars.json"), JSON.stringify({
    project_name: "test-app",
    description: '", "scripts": {"preinstall": "x"}'
  }), "utf8")

  const code = await runNew({
    name: "def007-app",
    template: templateDir,
    config: join(tmp, "vars.json"),
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 1, `expected code 1 for broken JSON, got ${code}`)
  process.exitCode = 0
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
