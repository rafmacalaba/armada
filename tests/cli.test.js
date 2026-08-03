import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, mkdtempSync, chmodSync, mkdirSync, symlinkSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../src/generator.js"
import { runCli, makeTempRepo, makeBin, parseFrontmatter } from "./helpers.js"
import { main } from "../src/cli.js"

function manifestYaml() {
  const m = { project: { name: "e2e", budget: "free", browserTesting: false, devcontainer: false,
    useAgentBrowser: false, stack: {} },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "free"), fallback: null, enabled: true })) }
  return renderManifestYaml(m, buildTeam(m))
}

test("help prints usage", async () => {
  const r = await runCli(["help"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /Usage:/)
})

test("no-args prints usage", async () => {
  const r = await runCli([])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /Usage:/)
})

test("-h and --help print usage", async () => {
  const r1 = await runCli(["-h"])
  const r2 = await runCli(["--help"])
  assert.strictEqual(r1.code, 0)
  assert.strictEqual(r2.code, 0)
  assert.match(r1.stdout, /Usage:/)
  assert.match(r2.stdout, /Usage:/)
})

test("ping returns ok", async () => {
  const r = await runCli(["ping"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /armada ok/)
})

test("unknown command returns exit code 1", async () => {
  const r = await runCli(["nope"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /Unknown command/)
})

test("main returns exit code 1 for unknown command", async () => {
  const prev = process.exitCode
  process.exitCode = 0
  const code = await main(["nope"])
  assert.strictEqual(code, 1)
  process.exitCode = prev
})

test("main returns 0 for successful init", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml() })
  const prev = process.exitCode
  process.exitCode = 0
  const code = await main(["init", "--from-armada", join(dir, "armada/armada.yaml"), "--target", dir])
  assert.strictEqual(code, 0)
  process.exitCode = prev
})

test("filesystem errors print message and hint", async () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-ro-"))
  chmodSync(dir, 0o555)
  const r = await runCli(["init", "--yes", "--budget", "free", "--no-browser"], { cwd: dir })
  chmodSync(dir, 0o755)
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /EACCES|permission denied/)
  assert.match(r.stderr, /check permissions/)
})

test("init --from-armada scaffolds full team", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml() })
  const r = await runCli(["init", "--from-armada", "armada/armada.yaml"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  for (const f of ["armada/armada.yaml", "opencode.json", "AGENTS.md", "armada/REQUIREMENTS.md",
    ".opencode/agent/orchestrator.md", ".opencode/commands/armada.md"])
    assert.ok(existsSync(join(dir, f)), `missing ${f}`)
})

test("init --dry-run writes nothing", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml() })
  const r = await runCli(["init", "--from-armada", "armada/armada.yaml", "--dry-run"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /dry-run/)
  assert.ok(!existsSync(join(dir, "armada/REQUIREMENTS.md")))
  assert.ok(!existsSync(join(dir, ".opencode")))
})

test("init --yes --budget free --no-browser works without TTY", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--yes", "--budget", "free", "--no-browser"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  const yaml = readFileSync(join(dir, "armada/armada.yaml"), "utf8")
  assert.match(yaml, /budget: "free"/)
  assert.match(yaml, /browserTesting: false/)
})

test("init --yes --stack overlays hint onto detected stack", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--yes", "--stack", "nextjs-fastapi", "--no-browser"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  const yaml = readFileSync(join(dir, "armada/armada.yaml"), "utf8")
  assert.match(yaml, /frontend: "nextjs"/)
  assert.match(yaml, /backend: "python-fastapi"/)
  assert.doesNotMatch(yaml, /none detected/)
})

test("init --from-armada missing manifest exits 1", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--from-armada", "nope.yaml"], { cwd: dir })
  assert.strictEqual(r.code, 1)
})

test("init --from-armada with bad YAML exits 1", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": "project: [unclosed" })
  const r = await runCli(["init", "--from-armada", "armada/armada.yaml"], { cwd: dir })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /invalid YAML/)
})

test("init --from-armada --budget free does not swallow budget as manifest", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml() })
  const r = await runCli(["init", "--from-armada", "--budget", "free"], { cwd: dir })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /Manifest not found: \(missing\)/)
})

test("models --refresh merges availability via fake opencode", async () => {
  const binDir = makeBin({ opencode: "#!/bin/sh\necho \"opencode/big-pickle\nopencode/mimo-v2.5-free\"\n" })
  const cache = join(makeTempRepo({}), "cache.json")
  const r = await runCli(["models", "--refresh", "--cache", cache], { env: { PATH: `${binDir}:${process.env.PATH}` } })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /✓/)
  assert.match(r.stdout, /✗/)
})

test("models without --refresh and no cache prints catalog without markers", async () => {
  const cache = join(makeTempRepo({}), "missing.json")
  const r = await runCli(["models", "free", "--cache", cache])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /free/)
  assert.doesNotMatch(r.stdout, /✓/)
})

test("models --refresh spawn failure exits 1", async () => {
  const binDir = makeBin({ opencode: "#!/bin/sh\nexit 1\n" })
  const cache = join(makeTempRepo({}), "cache.json")
  const r = await runCli(["models", "--refresh", "--cache", cache], { env: { PATH: `${binDir}:${process.env.PATH}` } })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /failed|command failed/)
})

test("uninstall CLI removes generated files, keeps user files", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml(), "AGENTS.md": "# custom\n" })
  await runCli(["init", "--from-armada", "armada/armada.yaml"], { cwd: dir })
  const r = await runCli(["uninstall"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.ok(!existsSync(join(dir, "armada/armada.yaml")))
  assert.ok(!existsSync(join(dir, "armada/REQUIREMENTS.md")))
  assert.ok(!existsSync(join(dir, "armada")))
  assert.ok(!existsSync(join(dir, ".opencode")))
  const agents = readFileSync(join(dir, "AGENTS.md"), "utf8")
  assert.match(agents, /^# custom/)
  assert.match(agents, /<!-- armada:start -->/)
  assert.ok(existsSync(join(dir, "opencode.json")))
})

test("uninstall CLI --all also removes generated user-facing files", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml() })
  await runCli(["init", "--from-armada", "armada/armada.yaml"], { cwd: dir })
  const r = await runCli(["uninstall", "--all"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.ok(!existsSync(join(dir, "AGENTS.md")))
  assert.ok(!existsSync(join(dir, "opencode.json")))
  assert.ok(!existsSync(join(dir, "armada/armada.yaml")))
  assert.ok(!existsSync(join(dir, "armada")))
})

test("uninstall CLI --dry-run removes nothing", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml() })
  await runCli(["init", "--from-armada", "armada/armada.yaml"], { cwd: dir })
  const r = await runCli(["uninstall", "--dry-run"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /dry-run/)
  assert.ok(existsSync(join(dir, ".opencode")))
  assert.ok(existsSync(join(dir, "armada/armada.yaml")))
})

test("uninstall CLI cleans known paths when manifest missing", async () => {
  const dir = makeTempRepo({
    "armada/armada.yaml": manifestYaml(),
    "armada/REQUIREMENTS.md": "# req",
    ".opencode/oh-my-opencode-slim.jsonc": "{}",
  })
  await runCli(["uninstall", "--from-armada", "nope.yaml"], { cwd: dir })
  assert.ok(!existsSync(join(dir, "armada/armada.yaml")))
  assert.ok(!existsSync(join(dir, "armada/REQUIREMENTS.md")))
  assert.ok(!existsSync(join(dir, "armada")))
  assert.ok(!existsSync(join(dir, ".opencode")))
})

test("uninstall CLI --from-armada without value cleans known paths", async () => {
  const dir = makeTempRepo({
    "armada/armada.yaml": manifestYaml(),
    "armada/REQUIREMENTS.md": "# req",
    ".opencode/oh-my-opencode-slim.jsonc": "{}",
  })
  const r = await runCli(["uninstall", "--from-armada"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.match(r.stderr, /Manifest not found/)
  assert.ok(!existsSync(join(dir, "armada/armada.yaml")))
})

test("uninstall CLI keeps user .opencode files and warns", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml(), ".opencode/agent/custom.md": "# custom\n" })
  await runCli(["init", "--from-armada", "armada/armada.yaml"], { cwd: dir })
  const r = await runCli(["uninstall"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.ok(!existsSync(join(dir, ".opencode/agent/backend-dev.md")))
  assert.ok(!existsSync(join(dir, ".opencode/commands")))
  assert.strictEqual(readFileSync(join(dir, ".opencode/agent/custom.md"), "utf8"), "# custom\n")
  assert.ok(existsSync(join(dir, ".opencode")))
  assert.match(r.stderr, /non-armada/)
})

test("init --headless sets manifest flag + scoped orchestrator bash allow", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--yes", "--headless", "--budget", "free", "--no-browser"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.match(readFileSync(join(dir, "armada/armada.yaml"), "utf8"), /headless: true/)
  const orch = readFileSync(join(dir, ".opencode/agent/orchestrator.md"), "utf8")
  const fm = orch.slice(orch.indexOf("---") + 3, orch.indexOf("---\n", 3))
  const cfg = parseFrontmatter(fm)
  assert.strictEqual(cfg.permission.bash["*"], "deny")
  assert.strictEqual(cfg.permission.bash["git status*"], "allow")
  assert.strictEqual(cfg.permission.bash["git diff*"], "allow")
  assert.strictEqual(cfg.permission.bash["git log*"], "allow")
})

test("init --requirements writes a per-feature contract file", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--yes", "--requirements", "REQUIREMENTS-admin.md", "--no-browser"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.ok(existsSync(join(dir, "REQUIREMENTS-admin.md")))
  assert.match(readFileSync(join(dir, "armada/armada.yaml"), "utf8"), /requirementsFile: "REQUIREMENTS-admin\.md"/)
})

test("init --target scaffolds into specified directory", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--yes", "--budget", "free", "--no-browser", "--target", dir])
  assert.strictEqual(r.code, 0)
  assert.ok(existsSync(join(dir, "armada/armada.yaml")))
})

test("init --target rejects symlink", async () => {
  const real = makeTempRepo({})
  const link = join(tmpdir(), `armada-link-${Date.now()}`)
  symlinkSync(real, link)
  const r = await runCli(["init", "--yes", "--budget", "free", "--no-browser", "--target", link])
  unlinkSync(link)
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /symlink/)
})

test("init rejects .opencode symlink under target", async () => {
  const real = mkdtempSync(join(tmpdir(), "armada-opc-real-"))
  const target = mkdtempSync(join(tmpdir(), "armada-opc-target-"))
  symlinkSync(real, join(target, ".opencode"))
  const r = await runCli(["init", "--yes", "--budget", "free", "--no-browser", "--target", target])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /symlink/)
})
