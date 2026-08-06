import { test } from "node:test"
import assert from "node:assert"
import { PassThrough } from "node:stream"
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pickCategory } from "../src/questionnaire.js"
import { runNew } from "../src/new-command.js"
import { runCli } from "./helpers.js"

// Helpers for mocking TTY/non-TTY input
function mockInput(data, isTTY = true) {
  const stream = new PassThrough()
  stream.isTTY = !!isTTY
  // Schedule data after a tick so readline can set up its listener first
  if (data !== undefined) {
    setImmediate(() => {
      stream.write(data)
      stream.end()
    })
  }
  return stream
}

function mockOutput() {
  const stream = new PassThrough()
  let buf = ""
  stream.on("data", (d) => { buf += d.toString() })
  stream.buffer = () => buf
  return stream
}

const catalog = [
  { id: "blank", name: "Blank project", description: "Empty skeleton.", dir: "starter/blank" },
  { id: "web-app", name: "Web application", description: "TypeScript + Vite + React.", dir: "starter/web-app" },
  { id: "api-service", name: "API service", description: "TypeScript + Express.", dir: "starter/api-service" },
]

// --- pickCategory tests ---

test("pickCategory opts.blank returns 'blank' immediately", async () => {
  const result = await pickCategory(catalog, { blank: true })
  assert.strictEqual(result, "blank")
})

test("pickCategory opts.template returns null immediately", async () => {
  const result = await pickCategory(catalog, { template: "/some/path" })
  assert.strictEqual(result, null)
})

test("pickCategory non-TTY returns 'blank'", async () => {
  const input = mockInput("", false)
  const output = mockOutput()
  const result = await pickCategory(catalog, { input, output })
  assert.strictEqual(result, "blank")
})

test("pickCategory TTY empty input defaults to first entry", async () => {
  const input = mockInput("\n", true)
  const output = mockOutput()
  const result = await pickCategory(catalog, { input, output })
  assert.strictEqual(result, "blank")
})

test("pickCategory TTY numbered input selects correct entry", async () => {
  const input = mockInput("2\n", true)
  const output = mockOutput()
  const result = await pickCategory(catalog, { input, output })
  assert.strictEqual(result, "web-app")
})

test("pickCategory TTY numbered input selects third entry", async () => {
  const input = mockInput("3\n", true)
  const output = mockOutput()
  const result = await pickCategory(catalog, { input, output })
  assert.strictEqual(result, "api-service")
})

test("pickCategory TTY out-of-range number defaults to first entry", async () => {
  const input = mockInput("42\n", true)
  const output = mockOutput()
  const result = await pickCategory(catalog, { input, output })
  assert.strictEqual(result, "blank")
})

test("pickCategory TTY case-insensitive id match", async () => {
  const input = mockInput("Web-App\n", true)
  const output = mockOutput()
  const result = await pickCategory(catalog, { input, output })
  assert.strictEqual(result, "web-app")
})

test("pickCategory TTY exact id match (lowercase)", async () => {
  const input = mockInput("api-service\n", true)
  const output = mockOutput()
  const result = await pickCategory(catalog, { input, output })
  assert.strictEqual(result, "api-service")
})

test("pickCategory TTY unmatched input falls back to first entry", async () => {
  const input = mockInput("nonexistent\n", true)
  const output = mockOutput()
  const result = await pickCategory(catalog, { input, output })
  assert.strictEqual(result, "blank")
})

// --- runNew matrix tests ---

test("runNew without template (non-interactive) defaults to blank template", async () => {
  const tmp = join(tmpdir(), "armada-nt-test-" + Date.now())
  mkdirSync(tmp, { recursive: true })

  const code = await runNew({
    name: "no-template-project",
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 0)
  const targetDir = join(tmp, "no-template-project")
  assert.strictEqual(existsSync(targetDir), true)
  // Blank template should copy its files
  assert.strictEqual(existsSync(join(targetDir, "README.md")), true)
  // Armada scaffold should create files
  assert.strictEqual(existsSync(join(targetDir, "armada", "REQUIREMENTS.md")), true)

  rmSync(tmp, { recursive: true, force: true })
})

test("runNew without template (opts.blank) uses blank template", async () => {
  const tmp = join(tmpdir(), "armada-nt-test2-" + Date.now())
  mkdirSync(tmp, { recursive: true })

  const code = await runNew({
    name: "blank-project",
    blank: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 0)
  assert.strictEqual(existsSync(join(tmp, "blank-project", "README.md")), true)
  assert.strictEqual(existsSync(join(tmp, "blank-project", "armada", "REQUIREMENTS.md")), true)

  rmSync(tmp, { recursive: true, force: true })
})

test("runNew --template <local-path> still works (external template)", async () => {
  const tmp = join(tmpdir(), "armada-nt-ext-" + Date.now())
  const templateDir = join(tmp, "template")
  mkdirSync(templateDir, { recursive: true })
  writeFileSync(join(templateDir, "README.md"), "# {{ cookiecutter.project_name }}", "utf8")

  writeFileSync(join(tmp, "vars.json"), JSON.stringify({ project_name: "ext-app" }), "utf8")

  const code = await runNew({
    name: "ext-project",
    template: templateDir,
    config: join(tmp, "vars.json"),
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 0)
  assert.strictEqual(existsSync(join(tmp, "ext-project", "README.md")), true)
  const readme = readFileSync(join(tmp, "ext-project", "README.md"), "utf8")
  assert.match(readme, /# ext-app/)

  rmSync(tmp, { recursive: true, force: true })
})

test("runNew with --config and non-interactive uses blank template", async () => {
  const tmp = join(tmpdir(), "armada-nt-cfg-" + Date.now())
  mkdirSync(tmp, { recursive: true })

  // Config with cookiecutter vars -- blank template has no variables,
  // so vars in config are harmless but the template should still render.
  writeFileSync(join(tmp, "vars.json"), JSON.stringify({ author_name: "tester" }), "utf8")

  const code = await runNew({
    name: "cfg-project",
    config: join(tmp, "vars.json"),
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 0)
  assert.strictEqual(existsSync(join(tmp, "cfg-project", "README.md")), true)
  assert.strictEqual(existsSync(join(tmp, "cfg-project", "armada", "REQUIREMENTS.md")), true)

  rmSync(tmp, { recursive: true, force: true })
})

test("runNew with --yes defaults to blank (no prompts)", async () => {
  const tmp = join(tmpdir(), "armada-nt-yes-" + Date.now())
  mkdirSync(tmp, { recursive: true })

  const code = await runNew({
    name: "yes-project",
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 0)
  assert.strictEqual(existsSync(join(tmp, "yes-project", ".gitkeep")), true)
  assert.strictEqual(existsSync(join(tmp, "yes-project", "armada", "REQUIREMENTS.md")), true)

  rmSync(tmp, { recursive: true, force: true })
})

// --- CLI-level matrix tests ---

test("cli 'armada new name' (non-TTY) succeeds without --template", async () => {
  const tmp = join(tmpdir(), "armada-cli-nt-" + Date.now())
  mkdirSync(tmp, { recursive: true })

  const r = await runCli(["new", "cli-project"], { cwd: tmp })

  assert.strictEqual(r.code, 0, `expected code 0, got ${r.code} stderr: ${r.stderr}`)
  assert.match(r.stdout, /Created cli-project/)
  assert.strictEqual(existsSync(join(tmp, "cli-project", "armada", "armada.yaml")), true)

  rmSync(tmp, { recursive: true, force: true })
})

test("cli 'armada new name --blank' succeeds", async () => {
  const tmp = join(tmpdir(), "armada-cli-blank-" + Date.now())
  mkdirSync(tmp, { recursive: true })

  const r = await runCli(["new", "blank-project", "--blank"], { cwd: tmp })

  assert.strictEqual(r.code, 0, `expected code 0, got ${r.code} stderr: ${r.stderr}`)
  assert.match(r.stdout, /Created blank-project/)
  assert.strictEqual(existsSync(join(tmp, "blank-project", "armada", "armada.yaml")), true)

  rmSync(tmp, { recursive: true, force: true })
})

test("cli 'armada new name --template <path>' succeeds", async () => {
  const tmp = join(tmpdir(), "armada-cli-tpl-" + Date.now())
  const templateDir = join(tmp, "template")
  mkdirSync(templateDir, { recursive: true })
  writeFileSync(join(templateDir, "README.md"), "# {{ cookiecutter.project_name }}", "utf8")

  writeFileSync(join(tmp, "vars.json"), JSON.stringify({ project_name: "tpl-app" }), "utf8")

  const r = await runCli([
    "new", "tpl-project",
    "--template", templateDir,
    "--config", join(tmp, "vars.json"),
  ], { cwd: tmp })

  assert.strictEqual(r.code, 0, `expected code 0, got ${r.code} stderr: ${r.stderr}`)
  assert.match(r.stdout, /Created tpl-project/)
  const readme = readFileSync(join(tmp, "tpl-project", "README.md"), "utf8")
  assert.match(readme, /# tpl-app/)

  rmSync(tmp, { recursive: true, force: true })
})

test("cli 'armada new name --yes' succeeds (blank default)", async () => {
  const tmp = join(tmpdir(), "armada-cli-yes-" + Date.now())
  mkdirSync(tmp, { recursive: true })

  const r = await runCli(["new", "yes-project", "--yes"], { cwd: tmp })

  assert.strictEqual(r.code, 0, `expected code 0, got ${r.code} stderr: ${r.stderr}`)
  assert.match(r.stdout, /Created yes-project/)
  assert.strictEqual(existsSync(join(tmp, "yes-project", "armada", "armada.yaml")), true)

  rmSync(tmp, { recursive: true, force: true })
})

test("cli 'armada new name --config <file>' succeeds (blank default in non-TTY)", async () => {
  const tmp = join(tmpdir(), "armada-cli-cfg-" + Date.now())
  mkdirSync(tmp, { recursive: true })
  writeFileSync(join(tmp, "vars.json"), JSON.stringify({ author_name: "cli-tester" }), "utf8")

  const r = await runCli(["new", "cfg-project", "--config", join(tmp, "vars.json")], { cwd: tmp })

  assert.strictEqual(r.code, 0, `expected code 0, got ${r.code} stderr: ${r.stderr}`)
  assert.match(r.stdout, /Created cfg-project/)
  assert.strictEqual(existsSync(join(tmp, "cfg-project", "armada", "armada.yaml")), true)

  rmSync(tmp, { recursive: true, force: true })
})

test("cli 'armada new' (no name) still errors", async () => {
  const r = await runCli(["new"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /project name is required/)
})

test("cli 'armada new' does NOT print 'missing required flag: --template'", async () => {
  // Verify the old hard requirement is gone
  const r = await runCli(["new"])
  assert.strictEqual(r.code, 1)
  assert.strictEqual(r.stderr.includes("missing required flag: --template"), false)
  assert.strictEqual(r.stderr.includes("--template"), false)
})

test("DEF-002: --template with no value errors", async () => {
  const tmp = join(tmpdir(), "armada-def002-" + Date.now())
  mkdirSync(tmp, { recursive: true })
  const r = await runCli(["new", "my-app", "--template"], { cwd: tmp })
  assert.strictEqual(r.code, 1, `expected code 1, got ${r.code}`)
  assert.match(r.stderr, /--template requires a value/)
  rmSync(tmp, { recursive: true, force: true })
})

test("DEF-002: --config with no value errors", async () => {
  const tmp = join(tmpdir(), "armada-def002b-" + Date.now())
  mkdirSync(tmp, { recursive: true })
  const r = await runCli(["new", "my-app", "--config"], { cwd: tmp })
  assert.strictEqual(r.code, 1, `expected code 1, got ${r.code}`)
  assert.match(r.stderr, /--config requires a value/)
  rmSync(tmp, { recursive: true, force: true })
})
