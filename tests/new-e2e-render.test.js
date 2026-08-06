import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runNew, discoverVariables } from "../src/new-command.js"
import { parseManifestYaml } from "../src/manifest.js"
import { runCli } from "./helpers.js"

// --- E2E template render: each of 6 categories with config vars ---

const TEMPLATES = [
  {
    id: "blank",
    vars: {},
    keyFiles: ["README.md"],
    assertVarInFile: null,
  },
  {
    id: "web-app",
    vars: { project_name: "test-web", author_name: "tester", author_email: "t@t", description: "A test web app", node_version: "20" },
    keyFiles: ["package.json"],
    assertVarInFile: { file: "README.md", pattern: /test-web/ },
  },
  {
    id: "ml-training",
    vars: { project_name: "test-ml", author_name: "tester", author_email: "t@t", description: "A test ML project", python_version: "3.11" },
    keyFiles: ["pyproject.toml"],
    assertVarInFile: { file: "README.md", pattern: /test-ml/ },
  },
  {
    id: "research-paper",
    vars: { project_name: "test-paper", author_name: "tester", author_email: "t@t", description: "A test paper" },
    keyFiles: ["paper.tex"],
    assertVarInFile: { file: "paper.tex", pattern: /test-paper/ },
  },
  {
    id: "api-service",
    vars: { project_name: "test-api", author_name: "tester", author_email: "t@t", description: "A test API service", node_version: "20" },
    keyFiles: ["package.json"],
    assertVarInFile: { file: "README.md", pattern: /test-api/ },
  },
  {
    id: "cli-tool",
    vars: { project_name: "test-cli", author_name: "tester", author_email: "t@t", description: "A test CLI tool", node_version: "20" },
    keyFiles: ["package.json"],
    assertVarInFile: { file: "README.md", pattern: /test-cli/ },
  },
]

for (const tpl of TEMPLATES) {
  test(`e2e render "${tpl.id}" -- renders vars, scaffolds armada team, round-trips yaml`, async () => {
    const tmp = join(tmpdir(), `armada-e2e-${tpl.id}-${Date.now()}`)
    mkdirSync(tmp, { recursive: true })

    const opts = {
      name: "my-app",
      template: join(process.cwd(), "starter", tpl.id),
      yes: true,
      cwd: tmp,
    }
    if (Object.keys(tpl.vars).length > 0) {
      const configPath = join(tmp, "vars.json")
      writeFileSync(configPath, JSON.stringify(tpl.vars), "utf8")
      opts.config = configPath
    }

    const code = await runNew(opts)
    assert.strictEqual(code, 0, `runNew for ${tpl.id} should exit 0`)
    const appDir = join(tmp, "my-app")
    assert.ok(existsSync(appDir), `${tpl.id}: output dir must exist`)

    for (const f of tpl.keyFiles) {
      assert.ok(existsSync(join(appDir, f)), `${tpl.id}: ${f} must exist`)
    }

    assert.ok(existsSync(join(appDir, "armada", "armada.yaml")), `${tpl.id}: armada.yaml must exist`)
    assert.ok(existsSync(join(appDir, "armada", "REQUIREMENTS.md")), `${tpl.id}: REQUIREMENTS.md must exist`)
    assert.ok(existsSync(join(appDir, ".opencode")), `${tpl.id}: .opencode dir must exist`)

    if (tpl.assertVarInFile) {
      const content = readFileSync(join(appDir, tpl.assertVarInFile.file), "utf8")
      assert.ok(tpl.assertVarInFile.pattern.test(content),
        `${tpl.id}: ${tpl.assertVarInFile.file} should contain substituted var`)
    }

    // armada.yaml round-trip
    const yamlPath = join(appDir, "armada", "armada.yaml")
    const yamlText = readFileSync(yamlPath, "utf8")
    let parsed
    try {
      parsed = parseManifestYaml(yamlText)
    } catch (err) {
      assert.fail(`${tpl.id}: parseManifestYaml threw: ${err.message}`)
    }
    assert.ok(parsed.project, `${tpl.id}: parsed must have project`)
    assert.ok(parsed.team, `${tpl.id}: parsed must have team`)
    assert.ok(Array.isArray(parsed.team), `${tpl.id}: team must be array`)
    assert.ok(parsed.team.length > 0, `${tpl.id}: team must not be empty`)

    rmSync(tmp, { recursive: true, force: true })
  })
}

// --- CLI seam: armada new --blank --yes then armada init preserves project identity ---

test("cli seam: armada new --blank --yes then armada init preserves project identity", async () => {
  const tmp = join(tmpdir(), `armada-seam-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })

  const r1 = await runCli(["new", "seam-app", "--blank", "--yes"], { cwd: tmp })
  assert.strictEqual(r1.code, 0, `armada new should succeed: ${r1.stderr}`)
  assert.match(r1.stdout, /Created seam-app/)

  const appDir = join(tmp, "seam-app")
  assert.ok(existsSync(join(appDir, "armada", "armada.yaml")), "armada.yaml must exist after new")

  const yamlBefore = readFileSync(join(appDir, "armada", "armada.yaml"), "utf8")
  const parsedBefore = parseManifestYaml(yamlBefore)

  // armada init re-runs scaffold; project name and budget must be preserved
  const r2 = await runCli(["init", "--yes", "--yolo", "--budget", "balanced"], { cwd: appDir })
  const yamlAfter = readFileSync(join(appDir, "armada", "armada.yaml"), "utf8")
  const parsedAfter = parseManifestYaml(yamlAfter)

  assert.strictEqual(parsedAfter.project.name, parsedBefore.project.name,
    "armada init must preserve project name")
  assert.strictEqual(parsedAfter.project.budget, parsedBefore.project.budget,
    "armada init must preserve budget")
  assert.ok(parsedAfter.team.length > 0, "team must still be populated")

  rmSync(tmp, { recursive: true, force: true })
})

// --- CLI seam: "Next:" hint output ---

test("cli seam: armada new --blank --yes output contains correct Next hint", async () => {
  const tmp = join(tmpdir(), `armada-hint-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })

  const r = await runCli(["new", "hint-app", "--blank", "--yes"], { cwd: tmp })
  assert.strictEqual(r.code, 0)

  assert.match(r.stdout, /cd hint-app/, "output must contain cd hint-app")
  assert.match(r.stdout, /opencode/, "output must contain opencode")
  assert.match(r.stdout, /armada status/, "output must contain armada status")
  assert.doesNotMatch(r.stdout, /armada init/, "output must NOT suggest armada init")

  rmSync(tmp, { recursive: true, force: true })
})

// --- Path safety regressions ---

test("rejects invalid project names: slash, absolute, dash, dots", async () => {
  for (const [label, name, pattern] of [
    ["slash", "bad/name", /path separator|invalid/],
    ["absolute", "/tmp/evil", /absolute|invalid/],
    ["dash", "-dash", /start with|invalid/],
    ["dots", "..", /\.\./],
  ]) {
    const r = await runCli(["new", name])
    assert.strictEqual(r.code, 1, `${label}: exit 1`)
    assert.match(r.stderr, pattern, `${label}: rejects`)
  }
})

test("rejects null bytes in project name (DEF-001)", async () => {
  process.exitCode = 0
  let stderr = ""
  const orig = console.error
  console.error = (...args) => { stderr += args.join(" ") + "\n" }
  try {
    const code = await runNew({ name: "bad\x00name", yes: true })
    assert.strictEqual(code, 1, "runNew must return 1")
    assert.strictEqual(process.exitCode, 1, "exitCode must be 1")
    assert.match(stderr, /null/, "must mention null bytes")
    assert.doesNotMatch(stderr, /ERR_INVALID_ARG/, "must not crash with ERR_INVALID_ARG_VALUE")
  } finally {
    console.error = orig
  }
})

// --- Catalog robustness ---

test("armada new with --blank renders blank template specifically", async () => {
  const tmp = join(tmpdir(), `armada-blank-e2e-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })

  const code = await runNew({
    name: "blank-e2e",
    blank: true,
    yes: true,
    cwd: tmp,
  })

  assert.strictEqual(code, 0)
  const appDir = join(tmp, "blank-e2e")
  assert.ok(existsSync(join(appDir, "README.md")), "blank must have README.md")
  assert.ok(existsSync(join(appDir, ".gitkeep")), "blank must have .gitkeep")
  assert.ok(existsSync(join(appDir, "armada", "armada.yaml")), "blank must have armada.yaml")

  rmSync(tmp, { recursive: true, force: true })
})
