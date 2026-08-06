import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
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
