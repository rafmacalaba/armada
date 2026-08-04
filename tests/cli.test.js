import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, mkdtempSync, chmodSync, mkdirSync, symlinkSync, unlinkSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFile, execSync } from "node:child_process"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../src/generator.js"
import { GITIGNORE_START } from "../src/scaffold.js"
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
    ".opencode/agent/commodore.md"])
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

test("init --budget free selects free-tier models for agents", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--yes", "--budget", "free", "--no-browser"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  const orch = readFileSync(join(dir, ".opencode/agent/commodore.md"), "utf8")
  assert.match(orch, new RegExp(`model: ${modelFor("orchestrator", "free")}`))
  const qa = readFileSync(join(dir, ".opencode/agent/corvette.md"), "utf8")
  assert.match(qa, new RegExp(`model: ${modelFor("qa", "free")}`))
  const yaml = readFileSync(join(dir, "armada/armada.yaml"), "utf8")
  assert.match(yaml, new RegExp(`model: "${modelFor("orchestrator", "free")}"`))
})

test("init --budget power selects power-tier models for agents", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--yes", "--budget", "power", "--no-browser"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  const orch = readFileSync(join(dir, ".opencode/agent/commodore.md"), "utf8")
  assert.match(orch, new RegExp(`model: ${modelFor("orchestrator", "power")}`))
})

test("init --yolo emits autonomous config (bash allow, keep boundaries)", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--yes", "--yolo", "--no-browser"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  const yaml = readFileSync(join(dir, "armada/armada.yaml"), "utf8")
  assert.match(yaml, /yolo: true/)
  const cfg = JSON.parse(readFileSync(join(dir, "opencode.json"), "utf8"))
  assert.strictEqual(cfg.permission["*"], "allow", "config catch-all allow")
  assert.strictEqual(cfg.permission.external_directory, "deny", "external dir stays denied")
  const orch = readFileSync(join(dir, ".opencode/agent/commodore.md"), "utf8")
  assert.match(orch, /\bbash:\n\s+"\*": allow/, "orchestrator bash allowed in yolo")
  assert.match(orch, /edit:\n\s+"\*": deny/, "orchestrator edit still denies (delegates)")
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
  const dir = makeTempRepo({})
  const prevCwd = process.cwd()
  process.chdir(dir)
  let r
  try {
    r = await runCli(["models", "--refresh", "--cache", "cache.json"], { env: { PATH: `${binDir}:${process.env.PATH}` } })
  } finally {
    process.chdir(prevCwd)
  }
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
  const dir = makeTempRepo({})
  const prevCwd = process.cwd()
  process.chdir(dir)
  let r
  try {
    r = await runCli(["models", "--refresh", "--cache", "cache.json"], { env: { PATH: `${binDir}:${process.env.PATH}` } })
  } finally {
    process.chdir(prevCwd)
  }
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
  assert.ok(!existsSync(join(dir, ".opencode/agent/galleon.md")))
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
  const orch = readFileSync(join(dir, ".opencode/agent/commodore.md"), "utf8")
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

test("init rejects .opencode/agent symlink under target", async () => {
  const real = mkdtempSync(join(tmpdir(), "armada-opc-a-real-"))
  const target = mkdtempSync(join(tmpdir(), "armada-opc-a-target-"))
  mkdirSync(join(target, ".opencode"), { recursive: true })
  symlinkSync(real, join(target, ".opencode/agent"), "dir")
  const r = await runCli(["init", "--yes", "--budget", "free", "--no-browser", "--target", target])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /symlink/)
  rmSync(real, { recursive: true, force: true })
})

test("init rejects .opencode/commands symlink under target", async () => {
  const real = mkdtempSync(join(tmpdir(), "armada-opc-c-real-"))
  const target = mkdtempSync(join(tmpdir(), "armada-opc-c-target-"))
  mkdirSync(join(target, ".opencode"), { recursive: true })
  symlinkSync(real, join(target, ".opencode/commands"), "dir")
  const r = await runCli(["init", "--yes", "--budget", "free", "--no-browser", "--target", target])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /symlink/)
  rmSync(real, { recursive: true, force: true })
})

test("doctor exits 1 via script mode when a check fails", async () => {
  const binDir = makeBin({ opencode: "#!/bin/sh\nexit 1\n" })
  const r = await runCli(["doctor"], { env: { PATH: `${binDir}:${process.env.PATH}` } })
  assert.strictEqual(r.code, 1)
  assert.match(r.stdout, /opencode CLI: fail/)
})

test("drive boots a lane session and prints success", async () => {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  const lanePath = mkdtempSync(join(tmpdir(), "drive-lane-"))
  const r = await runCli(["drive", lanePath], { env: { PATH: binDir } })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /session/)
  assert.match(r.stdout, /auto-attach skipped/)
  assert.match(r.stdout, /tmux attach -t/)
})

test("drive with nonexistent path exits 1", async () => {
  const r = await runCli(["drive", "/nonexistent/path/12345"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /lane path not found/)
})

test("drive --help prints usage without booting a session", async () => {
  const r = await runCli(["drive", "--help"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /Usage:/)
  assert.doesNotMatch(r.stdout, /creating session/)
  const rh = await runCli(["drive", "-h"])
  assert.strictEqual(rh.code, 0)
  assert.match(rh.stdout, /Usage:/)
})

test("drive dismisses boot-time modals (including repeat) before sending the prompt", async () => {
  const home = mkdtempSync(join(tmpdir(), "drive-home-"))
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: `#!/bin/sh
STATE="$HOME/.drive-test-captures"
case "$1" in
  has-session) exit 1 ;;
  new-session) exit 0 ;;
  capture-pane)
    c=0
    if [ -f "$STATE" ]; then read c < "$STATE"; fi
    c=$((c+1))
    echo "$c" > "$STATE"
    if [ "$c" -le 3 ]; then printf "What feature do you want to build?\\nesc dismiss\\n"; else printf "tab agents\\nctrl+p\\nthinking\\n"; fi
    exit 0 ;;
  send-keys) exit 0 ;;
  *) exit 1 ;;
esac
`,
  })
  const lanePath = mkdtempSync(join(tmpdir(), "drive-modal-"))
  const r = await runCli(["drive", lanePath], { env: { PATH: binDir, HOME: home } })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /modal detected, dismissing with Escape/)
  assert.match(r.stdout, /session/)
})

test("drive --no-open prints skipped message", async () => {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  const lanePath = mkdtempSync(join(tmpdir(), "drive-noopen-"))
  const r = await runCli(["drive", "--no-open", lanePath], { env: { PATH: binDir } })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /--no-open: skipped auto-attach/)
  assert.match(r.stdout, /session/)
})

// DEF-011: --name with single-dash value
test("drive --name=-foo exits 1 with clear error", async () => {
  const r = await runCli(["drive", "--name=-foo", "/tmp"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /session name cannot start with/)
})

// DEF-012: --timeout non-numeric falls back to default
test("drive --timeout=abc falls back to default 30000", async () => {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  const lanePath = mkdtempSync(join(tmpdir(), "drive-to-abc-"))
  const r = await runCli(["drive", "--timeout=abc", lanePath], { env: { PATH: binDir } })
  assert.strictEqual(r.code, 0)
})

// DEF-012: --timeout=0 exits 1
test("drive --timeout=0 exits 1 with error", async () => {
  const r = await runCli(["drive", "--timeout=0", "/tmp"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /timeout must be a positive integer/)
})

// DEF-014: reattach message says "already running", not "prompt registered"
test("drive on existing session says already running", async () => {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 0 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  const lanePath = mkdtempSync(join(tmpdir(), "drive-reattach-"))
  const r = await runCli(["drive", lanePath], { env: { PATH: binDir } })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /already running|reattach/)
  assert.doesNotMatch(r.stdout, /prompt registered/)
})

// DEF-015: --prompt starting with -- exits 1
test("drive --prompt starting with -- exits 1", async () => {
  const r = await runCli(["drive", "--prompt", "--custom", "/tmp"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /--prompt value cannot start with/)
})

// Phase 2: auto-open enabled, no terminal available -> fallback hint
test("drive auto-open falls back with hint when no terminal available", async () => {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  const lanePath = mkdtempSync(join(tmpdir(), "drive-fallback-"))
  const r = await runCli(["drive", lanePath], {
    env: { PATH: binDir, DISPLAY: "" },
  })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /session/)
  assert.match(r.stdout, /auto-attach skipped/)
  assert.match(r.stdout, /tmux attach -t/)
  assert.match(r.stdout, /attach manually/)
})

// Phase 2: --no-open skips auto-open, prints skip message
test("drive --no-open skips auto-open and prints skip message", async () => {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  const lanePath = mkdtempSync(join(tmpdir(), "drive-noopen2-"))
  const r = await runCli(["drive", "--no-open", lanePath], { env: { PATH: binDir } })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /--no-open: skipped auto-attach/)
  assert.match(r.stdout, /session/)
  assert.doesNotMatch(r.stdout, /auto-attach skipped/)
  assert.doesNotMatch(r.stdout, /attach manually/)
})

// Phase 2: auto-open with fake terminal succeeds (platform-adaptive)
test("drive auto-open succeeds when terminal is available", async () => {
  const plat = process.platform
  // macOS: fake osascript + open; Linux: fake wezterm with DISPLAY; Windows: fake wt
  const fakeBin = {}
  const envExtra = {}
  if (plat === "darwin") {
    fakeBin.osascript = "#!/bin/sh\nexit 0\n"
    fakeBin.open = "#!/bin/sh\nexit 0\n"
  } else if (plat === "win32") {
    fakeBin.wt = "@echo off\nexit /b 0\n"
    envExtra.DISPLAY = ":0"
  } else {
    // Linux
    fakeBin.wezterm = "#!/bin/sh\nexit 0\n"
    envExtra.DISPLAY = ":0"
  }
  fakeBin.opencode = "#!/bin/sh\nexit 0\n"
  fakeBin.tmux = "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n"

  const binDir = makeBin(fakeBin)
  const lanePath = mkdtempSync(join(tmpdir(), "drive-auto-"))
  const r = await runCli(["drive", lanePath], {
    env: { PATH: binDir, ...envExtra, TERM_PROGRAM: "", VSCODE_IPC_HOOK_CLI: "" },
  })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /session/)
  assert.match(r.stdout, /auto-attached in/)
  assert.doesNotMatch(r.stdout, /auto-attach skipped/)
})

// --heartbeat opt-in: starts heartbeat on first boot; kills child to avoid hang
test("drive --heartbeat starts a heartbeat for the session", async () => {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  const lanePath = mkdtempSync(join(tmpdir(), "drive-hb-"))
  const runsDir = mkdtempSync(join(tmpdir(), "armada-runs-"))
  const CLI = join(process.cwd(), "src/cli.js")

  let stdoutAll = ""
  const child = execFile(process.execPath, [CLI, "drive", "--heartbeat", "--no-open", lanePath], {
    env: { ...process.env, PATH: binDir, ARMADA_RUNS_DIR: runsDir },
  })

  let hbStarted = false
  let driveDone = false
  await new Promise((resolve) => {
    child.stdout.on("data", (data) => {
      stdoutAll += data.toString()
      if (stdoutAll.includes("started heartbeat")) hbStarted = true
      if (stdoutAll.includes("armada drive: session")) driveDone = true
      if (hbStarted && driveDone) resolve()
    })
    child.on("close", resolve)
    setTimeout(resolve, 10_000)
  })

  assert.ok(driveDone, "drive should report session ready")
  assert.ok(hbStarted, "heartbeat should have started")
  assert.match(stdoutAll, /started heartbeat/, "heartbeat logged in output")

  // Kill the child to confirm SIGINT handler stops the interval cleanly
  child.kill("SIGINT")

  await new Promise((resolve) => {
    child.on("close", resolve)
    setTimeout(resolve, 5_000)
  })
})

// -- Phase 1: managed .gitignore block CLI tests --

test("init --yes writes managed .gitignore block", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--yes", "--budget", "free", "--no-browser"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  const gi = readFileSync(join(dir, ".gitignore"), "utf8")
  assert.match(gi, /# armada:start/)
  assert.match(gi, /\/armada\//)
  assert.match(gi, /\/\.opencode\//)
  assert.match(gi, /\/opencode\.json/)
})

test("init --yes from a fresh git repo leaves clean git status", async () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-clean-"))
  execSync("git init -q", { cwd: dir })
  const r = await runCli(["init", "--yes", "--budget", "free", "--no-browser"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  const status = execSync("git status --short", { cwd: dir, encoding: "utf8" })
  // Expect no armada-owned untracked files
  assert.doesNotMatch(status, /\?{2} armada\//)
  assert.doesNotMatch(status, /\?{2} \.opencode\//)
  assert.doesNotMatch(status, /\?{2} opencode\.json/)
})

test("uninstall removes gitignore block and restores prior content", async () => {
  const dir = makeTempRepo({})
  writeFileSync(join(dir, ".gitignore"), "node_modules/\n.env\n")
  await runCli(["init", "--yes", "--budget", "free", "--no-browser"], { cwd: dir })
  // Verify block was added
  let gi = readFileSync(join(dir, ".gitignore"), "utf8")
  assert.match(gi, /# armada:start/)
  assert.match(gi, /node_modules/)
  // Uninstall
  const r = await runCli(["uninstall"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  gi = readFileSync(join(dir, ".gitignore"), "utf8")
  assert.doesNotMatch(gi, /# armada:start/)
  assert.match(gi, /node_modules/)
  assert.match(gi, /\.env/)
})

test("uninstall --dry-run does not modify .gitignore", async () => {
  const dir = makeTempRepo({})
  await runCli(["init", "--yes", "--budget", "free", "--no-browser"], { cwd: dir })
  const before = readFileSync(join(dir, ".gitignore"), "utf8")
  const r = await runCli(["uninstall", "--dry-run"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  const after = readFileSync(join(dir, ".gitignore"), "utf8")
  assert.strictEqual(after, before)
})

// DEF-002: voyage --help and drive --help print usage, do not boot a lane
test("voyage --help prints usage and exits 0", async () => {
  const r = await runCli(["voyage", "--help"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /Usage:/)
  assert.match(r.stdout, /armada voyage/)
  assert.match(r.stdout, /armada drive.*alias for voyage/)
})

test("drive --help prints usage and exits 0", async () => {
  const r = await runCli(["drive", "--help"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /Usage:/)
  assert.match(r.stdout, /armada voyage/)
  assert.match(r.stdout, /armada drive.*alias for voyage/)
})

// -- Phase 4: armada voyage (primary command; drive = alias) --

test("voyage boots a lane session and prints success", async () => {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  const lanePath = mkdtempSync(join(tmpdir(), "voyage-lane-"))
  const r = await runCli(["voyage", lanePath], { env: { PATH: binDir } })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /session/)
  assert.match(r.stdout, /auto-attach skipped/)
  assert.match(r.stdout, /tmux attach -t/)
  assert.match(r.stdout, /armada voyage:/)
})

test("voyage with nonexistent path exits 1", async () => {
  const r = await runCli(["voyage", "/nonexistent/path/12345"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /lane path not found/)
})

test("voyage --no-open prints skipped message", async () => {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  const lanePath = mkdtempSync(join(tmpdir(), "voyage-noopen-"))
  const r = await runCli(["voyage", "--no-open", lanePath], { env: { PATH: binDir } })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /--no-open: skipped auto-attach/)
  assert.match(r.stdout, /session/)
})

test("voyage on existing session says already running", async () => {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 0 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  const lanePath = mkdtempSync(join(tmpdir(), "voyage-reattach-"))
  const r = await runCli(["voyage", lanePath], { env: { PATH: binDir } })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /already running|reattach/)
  assert.doesNotMatch(r.stdout, /prompt registered/)
})
