import { test } from "node:test"
import assert from "node:assert"
import { PassThrough, Readable } from "node:stream"
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pickCategory } from "../src/questionnaire.js"
import { runNew, resolveVariables } from "../src/new-command.js"
import { runCli } from "./helpers.js"

// Helpers for mocking TTY/non-TTY input
function mockInput(data, isTTY = true) {
  const stream = new PassThrough()
  stream.isTTY = !!isTTY
  if (data !== undefined) {
    setImmediate(() => {
      stream.write(data)
      stream.end()
    })
  }
  return stream
}

function mockMultiInput(lines, isTTY = true) {
  const stream = new PassThrough()
  stream.isTTY = !!isTTY
  const data = Array.isArray(lines) ? lines.join("") : lines
  setImmediate(() => {
    stream.write(data)
    stream.end()
  })
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

test("pickCategory: immediate returns for blank/template opts, non-TTY defaults", async () => {
  // opts.blank returns 'blank'
  assert.strictEqual(await pickCategory(catalog, { blank: true }), "blank")
  // opts.template returns null
  assert.strictEqual(await pickCategory(catalog, { template: "/some/path" }), null)
  // non-TTY returns 'blank'
  assert.strictEqual(await pickCategory(catalog, { input: mockInput("", false), output: mockOutput() }), "blank")
})

test("pickCategory: TTY input selection and re-prompt behaviour", async () => {
  for (const [label, input, isTTY, expected] of [
    ["empty defaults to first", "\n", true, "blank"],
    ["number selects 2", "2\n", true, "web-app"],
    ["number selects 3", "3\n", true, "api-service"],
    ["case-insensitive id", "Web-App\n", true, "web-app"],
    ["exact id lowercase", "api-service\n", true, "api-service"],
  ]) {
    const result = await pickCategory(catalog, { input: mockInput(input, isTTY), output: mockOutput() })
    assert.strictEqual(result, expected, label)
  }
  // out-of-range re-prompts then accepts valid
  const inReject = mockMultiInput(["999\n", "2\n"], true)
  const outReject = mockOutput()
  assert.strictEqual(await pickCategory(catalog, { input: inReject, output: outReject }), "web-app", "reject then accept")
  assert.match(outReject.buffer(), /invalid/i)
  // unmatched re-prompts 3x then null
  const inFail = mockMultiInput(["nonexistent\n", "bad\n", "nope\n"], true)
  assert.strictEqual(await pickCategory(catalog, { input: inFail, output: mockOutput() }), null)
})

// --- runNew matrix tests ---

test("runNew defaults to blank template in various non-interactive modes", async () => {
  for (const [label, opts] of [
    ["yes", { name: "no-template-project", yes: true }],
    ["blank", { name: "blank-project", blank: true }],
    ["config", { name: "cfg-project", config: null, yes: true }], // config set below
    ["yes-default", { name: "yes-project", yes: true }],
  ]) {
    const tmp = join(tmpdir(), `armada-nt-${label}-${Date.now()}`)
    mkdirSync(tmp, { recursive: true })
    if (label === "config") writeFileSync(join(tmp, "vars.json"), JSON.stringify({ author_name: "tester" }), "utf8")
    const runOpts = { ...opts, cwd: tmp }
    if (label === "config") runOpts.config = join(tmp, "vars.json")
    const code = await runNew(runOpts)
    assert.strictEqual(code, 0, `${label} exit 0`)
    const targetDir = join(tmp, runOpts.name)
    assert.strictEqual(existsSync(targetDir), true, `${label} dir exists`)
    assert.strictEqual(existsSync(join(targetDir, "armada", "REQUIREMENTS.md")), true, `${label} armada scaffolded`)
    rmSync(tmp, { recursive: true, force: true })
  }
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

// --- CLI-level matrix tests ---

test("cli 'armada new name' non-TTY, --blank, --yes all succeed", async () => {
  for (const [label, args] of [
    ["non-TTY", ["new", "cli-project"]],
    ["--blank", ["new", "blank-project", "--blank"]],
    ["--yes", ["new", "yes-project", "--yes"]],
  ]) {
    const tmp = join(tmpdir(), `armada-cli-${label}-${Date.now()}`)
    mkdirSync(tmp, { recursive: true })
    const r = await runCli(args, { cwd: tmp })
    assert.strictEqual(r.code, 0, `${label}: expected code 0, got ${r.code} stderr: ${r.stderr}`)
    assert.match(r.stdout, /Created /)
    assert.strictEqual(existsSync(join(tmp, args[1], "armada", "armada.yaml")), true, `${label} has armada.yaml`)
    rmSync(tmp, { recursive: true, force: true })
  }
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

test("DEF-013: pickCategory handles stdin close without hanging", async () => {
  // TTY stream that closes immediately with no data written
  const input = new PassThrough()
  input.isTTY = true
  // Close the stream immediately — no data will ever be written
  input.end()
  const output = mockOutput()

  const result = await pickCategory(catalog, { input, output })

  // Should return first entry as fallback, not hang
  assert.strictEqual(result, "blank", "should default to first entry on stdin close")
})

test("DEF-004: resolveVariables applies defaultVars as fallback for unresolved vars", async () => {
  // Exported resolveVariables accepts (discovered, opts, defaultVars)
  const discovered = ["project_name", "node_version", "author_name"]
  const [vars] = await resolveVariables(discovered, { yes: true }, {
    project_name: "default-app",
    node_version: "20",
    author_name: "Default Author",
  })

  assert.strictEqual(vars.project_name, "default-app", "project_name should use defaultVars")
  assert.strictEqual(vars.node_version, "20", "node_version should use defaultVars")
  assert.strictEqual(vars.author_name, "Default Author", "author_name should use defaultVars")
})
