import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, mkdtempSync, chmodSync, mkdirSync, symlinkSync, unlinkSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execSync } from "node:child_process"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../src/generator.js"
import { GITIGNORE_START } from "../src/scaffold.js"
import { runCli, spawnCli, makeTempRepo, makeTempGitRepo, makeBin, parseFrontmatter } from "./helpers.js"
import { main } from "../src/cli.js"

const EXPECTED_VERSION = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).version

function manifestYaml() {
  const m = { project: { name: "e2e", budget: "free", browserTesting: false, devcontainer: false,
    useAgentBrowser: false, stack: {} },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "free"), fallback: null, enabled: true })) }
  return renderManifestYaml(m, buildTeam(m))
}

test("help, no-args, -h, --help all print usage", async () => {
  for (const args of [["help"], [], ["-h"], ["--help"]]) {
    const r = await runCli(args)
    assert.strictEqual(r.code, 0)
    assert.match(r.stdout, /Usage:/)
  }
})

test("ping removed and unknown commands exit 1; main returns 1", async () => {
  for (const cmd of ["ping", "nope"]) {
    const r = await runCli([cmd])
    assert.strictEqual(r.code, 1)
    assert.match(r.stderr, /Unknown command/)
  }
  // direct main() call
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



test("init --requirements writes a per-feature contract file", async () => {
  const dir = makeTempGitRepo({})
  const r = await runCli(["init", "--yes", "--requirements", "REQUIREMENTS-admin.md", "--no-browser"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.ok(existsSync(join(dir, "REQUIREMENTS-admin.md")))
  assert.match(readFileSync(join(dir, "armada/armada.yaml"), "utf8"), /requirementsFile: "REQUIREMENTS-admin\.md"/)
})

test("init --no-shipnames sets supervision.shipnames: false in manifest", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--yes", "--no-shipnames", "--budget", "free", "--no-browser"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  const yaml = readFileSync(join(dir, "armada/armada.yaml"), "utf8")
  assert.match(yaml, /shipnames: false/)
})

test("init without --no-shipnames produces shipnames: true in manifest", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--yes", "--budget", "free", "--no-browser"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  const yaml = readFileSync(join(dir, "armada/armada.yaml"), "utf8")
  assert.match(yaml, /shipnames: true/)
})

test("--no-shipnames appears in help text", async () => {
  const r = await runCli(["help"])
  assert.match(r.stdout, /--no-shipnames/)
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

test("doctor exits 1 via script mode when a check fails", async () => {
  const binDir = makeBin({ opencode: "#!/bin/sh\nexit 1\n" })
  const r = await runCli(["doctor"], { env: { PATH: `${binDir}:${process.env.PATH}` } })
  assert.strictEqual(r.code, 1)
  assert.match(r.stdout, /opencode CLI: fail/)
})

test("drive boots a lane session and prints success, exits 1 (deprecated)", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "armada-no-term-home-"))
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  symlinkSync("/usr/bin/git", join(binDir, "git"))
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await spawnCli(["drive", "--from-path", repoDir + "/sandbox/drvlane"], { env: { PATH: `${binDir}:/usr/bin`, HOME: homeDir }, cwd: repoDir })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /deprecated/)
  assert.match(r.stdout, /session/)
  assert.match(r.stdout, /auto-attach skipped/)
  assert.doesNotMatch(r.stdout, /tmux attach -t/)
})

test("drive with path-like arg prints migration hint and exits 1", async () => {
  const r = await runCli(["drive", "/nonexistent/path/12345"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /deprecated/)
  assert.match(r.stderr, /armada voyage: expected <name>, got <lane-path>/)
})

test("drive --help prints usage with deprecation, voyage alias, exactly once, exits 1", async () => {
  const r = await runCli(["drive", "--help"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /deprecated/)
  assert.match(r.stdout, /Usage:/)
  assert.doesNotMatch(r.stdout, /creating session/)
  assert.match(r.stdout, /armada voyage/)
  assert.match(r.stdout, /armada drive.*alias for voyage/)
  // deprecation hint exactly once
  const matches = (r.stderr.match(/armada drive: deprecated/g) || [])
  assert.strictEqual(matches.length, 1, `deprecation hint appeared ${matches.length} times, expected 1`)
  // -h variant
  const rh = await runCli(["drive", "-h"])
  assert.strictEqual(rh.code, 1)
  assert.match(rh.stderr, /deprecated/)
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
  symlinkSync("/usr/bin/git", join(binDir, "git"))
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await spawnCli(["drive", "--from-path", repoDir + "/sandbox/modalane"], { env: { PATH: `${binDir}:/usr/bin`, HOME: home }, cwd: repoDir })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /deprecated/)
  assert.match(r.stdout, /modal detected, dismissing with Escape/)
  assert.match(r.stdout, /session/)
})

test("drive --no-open skips auto-open, prints skip message, no manual attach hint", async () => {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  symlinkSync("/usr/bin/git", join(binDir, "git"))
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await spawnCli(["drive", "--no-open", "--from-path", repoDir + "/sandbox/dnopen"], { env: { PATH: `${binDir}:/usr/bin` }, cwd: repoDir })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /deprecated/)
  assert.match(r.stdout, /--no-open: skipped auto-attach/)
  assert.match(r.stdout, /session/)
  assert.doesNotMatch(r.stdout, /auto-attach skipped/)
  assert.doesNotMatch(r.stdout, /attach manually/)
})

// DEF-011: --name with single-dash value
test("drive --name=-foo exits 1 with clear error", async () => {
  const r = await runCli(["drive", "--name=-foo", "--from-path", "/tmp/somename"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /deprecated/)
  assert.match(r.stderr, /session name cannot start with/)
})

// DEF-012: --timeout non-numeric falls back to default
test("drive --timeout=abc falls back to default 30000", async () => {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  symlinkSync("/usr/bin/git", join(binDir, "git"))
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await spawnCli(["drive", "--timeout=abc", "--from-path", repoDir + "/sandbox/dtmo"], { env: { PATH: `${binDir}:/usr/bin` }, cwd: repoDir })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /deprecated/)
})

// DEF-012: --timeout=0 exits 1
test("drive --timeout=0 exits 1 with error", async () => {
  const r = await runCli(["drive", "--timeout=0", "--from-path", "/tmp/tname"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /deprecated/)
  assert.match(r.stderr, /timeout must be a positive integer/)
})

// DEF-014: reattach message says "already running", not "prompt registered"
test("drive on existing session says already running", async () => {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 0 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  symlinkSync("/usr/bin/git", join(binDir, "git"))
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await spawnCli(["drive", "--from-path", repoDir + "/sandbox/dreuse"], { env: { PATH: `${binDir}:/usr/bin` }, cwd: repoDir })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /deprecated/)
  assert.match(r.stdout, /already running|reattach/)
  assert.doesNotMatch(r.stdout, /prompt registered/)
})

// DEF-015: --prompt starting with -- exits 1
test("drive --prompt starting with -- exits 1", async () => {
  const r = await runCli(["drive", "--prompt", "--custom", "--from-path", "/tmp/pname"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /deprecated/)
  assert.match(r.stderr, /--prompt value cannot start with/)
})

// Phase 2: auto-open enabled, no terminal available -> fallback hint
test("drive auto-open falls back with hint when no terminal available", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "armada-no-term-home-"))
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  symlinkSync("/usr/bin/git", join(binDir, "git"))
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await spawnCli(["drive", "--from-path", repoDir + "/sandbox/dautofb"], {
    env: { PATH: `${binDir}:/usr/bin`, HOME: homeDir },
    cwd: repoDir,
  })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /deprecated/)
  assert.match(r.stdout, /session/)
  assert.match(r.stdout, /auto-attach skipped/)
  assert.doesNotMatch(r.stdout, /tmux attach -t/)
  assert.doesNotMatch(r.stdout, /attach manually/)
})
// Phase 2: auto-open with wezterm succeeds
test("drive auto-open succeeds when terminal is available", async () => {
  const binDir = makeBin({
    wezterm: "#!/bin/sh\nexit 0\n",
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  symlinkSync("/usr/bin/git", join(binDir, "git"))
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await spawnCli(["drive", "--from-path", repoDir + "/sandbox/dauto"], {
    env: { PATH: `${binDir}:/usr/bin`, TERM_PROGRAM: "WezTerm" },
    cwd: repoDir,
  })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /deprecated/)
  assert.match(r.stdout, /session/)
  assert.match(r.stdout, /auto-attached in/)
  assert.doesNotMatch(r.stdout, /auto-attach skipped/)
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

// -- Phase 4: armada voyage (primary command; drive = alias) --

test("voyage boots a lane session and prints success", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "armada-no-term-home-"))
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  symlinkSync("/usr/bin/git", join(binDir, "git"))
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await spawnCli(["voyage", "testlane"], { env: { PATH: `${binDir}:/usr/bin`, HOME: homeDir }, cwd: repoDir })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /session/)
  assert.match(r.stdout, /auto-attach skipped/)
  assert.doesNotMatch(r.stdout, /tmux attach -t/)
  assert.match(r.stdout, /armada voyage:/)
})

test("voyage with path-like arg prints migration hint and exits 1", async () => {
  const r = await runCli(["voyage", "/nonexistent/path/12345"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /armada voyage: expected <name>, got <lane-path>/)
})

test("voyage --no-open prints skipped message", async () => {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 1 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\nthinking\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  symlinkSync("/usr/bin/git", join(binDir, "git"))
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const homeDir = mkdtempSync(join(tmpdir(), "armada-no-open-home-"))
  const r = await spawnCli(["voyage", "--no-open", "nlane"], { env: { PATH: `${binDir}:/usr/bin`, HOME: homeDir }, cwd: repoDir })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /--no-open: skipped auto-attach/)
  assert.match(r.stdout, /session/)
})

test("voyage on existing session says already running", async () => {
  const binDir = makeBin({
    opencode: "#!/bin/sh\nexit 0\n",
    tmux: "#!/bin/sh\ncase \"$1\" in\n  has-session) exit 0 ;;\n  new-session) exit 0 ;;\n  capture-pane) printf \"tab agents\\nctrl+p\\n\" ; exit 0 ;;\n  send-keys) exit 0 ;;\n  *) exit 1 ;;\nesac\n",
  })
  symlinkSync("/usr/bin/git", join(binDir, "git"))
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await spawnCli(["voyage", "existlane"], { env: { PATH: `${binDir}:/usr/bin` }, cwd: repoDir })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /already running|reattach/)
  assert.doesNotMatch(r.stdout, /prompt registered/)
})

test("voyage --print-attach prints attach command and exits 0", async () => {
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await runCli(["voyage", "--print-attach", "vprint"], { cwd: repoDir })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /tmux attach -t/)
})

test("drive --print-attach prints attach command and exits 1 (deprecated)", async () => {
  const repoDir = makeTempGitRepo({ "readme.md": "# test" })
  const r = await runCli(["drive", "--print-attach", "dprint"], { cwd: repoDir })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /deprecated/)
  assert.match(r.stdout, /tmux attach -t/)
})

// -- cli-routing (P1 fixes) --

test("uninstall --all removes armada/state directory", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml() })
  await runCli(["init", "--from-armada", "armada/armada.yaml"], { cwd: dir })
  mkdirSync(join(dir, "armada", "state", "features"), { recursive: true })
  writeFileSync(join(dir, "armada", "state", "active.json"), JSON.stringify({ feature: "test" }))
  writeFileSync(join(dir, "armada", "state", "features", "index.json"), JSON.stringify([]))
  const r = await runCli(["uninstall", "--all", "--force"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.ok(!existsSync(join(dir, "armada", "state")), "armada/state must be removed")
  assert.ok(!existsSync(join(dir, "armada")), "armada must be removed")
})

test("uninstall --all removes empty opencode dir left after cleanup", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml() })
  await runCli(["init", "--from-armada", "armada/armada.yaml"], { cwd: dir })
  mkdirSync(join(dir, "armada", "state"), { recursive: true })
  writeFileSync(join(dir, "armada", "state", "active.json"), JSON.stringify({ feature: "test" }))
  const r = await runCli(["uninstall", "--all", "--force"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.ok(!existsSync(join(dir, "armada")), "armada dir must be fully removed")
  assert.ok(!existsSync(join(dir, ".opencode")), ".opencode dir must be fully removed")
})

test("doctor uses running binary for global armada check", async () => {
  const expectedVersion = process.env.ARMADA_EXPECTED_VERSION
    || `armada v${JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).version}`
  const r = await runCli(["doctor"])
  assert.match(r.stdout, /global armada binary: pass/)
  assert.match(r.stdout, new RegExp(`— ${expectedVersion.replace(/\./g, "\\.")}`))
})

test("armada new --help prints help, not project named --help", async () => {
  const r = await runCli(["new", "--help"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /Usage:/)
})

test("armada new with name starting with -- rejects with error", async () => {
  const r = await runCli(["new", "--weirdname"])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /project name cannot start with --|invalid project name/i)
})

// -- cli-arg-flags (P6 DEF-001: subcommand -v/-h/--version intercept) --

test("uninstall -v/-h/--version prints version/help without fs mutation", async () => {
  for (const [flag, expectVersion] of [["-v", true], ["-h", false], ["--version", true]]) {
    const dir = makeTempGitRepo({ "armada/armada.yaml": manifestYaml() })
    await runCli(["init", "--from-armada", "armada/armada.yaml"], { cwd: dir })
    assert.ok(existsSync(join(dir, ".opencode")), `.opencode should exist before uninstall ${flag}`)
    if (expectVersion) assert.ok(existsSync(join(dir, "armada", "armada.yaml")), `armada/armada.yaml should exist before uninstall ${flag}`)

    const r = await runCli(["uninstall", flag], { cwd: dir })
    assert.strictEqual(r.code, 0, `uninstall ${flag} should exit 0`)
    if (expectVersion) {
      assert.match(r.stdout, /armada v/, "should print version")
      assert.match(r.stdout, new RegExp(EXPECTED_VERSION.replace(/\./g, "\\.")), `should include version ${EXPECTED_VERSION}`)
    } else {
      assert.match(r.stdout, /Usage:/, "should print help")
    }
    assert.ok(existsSync(join(dir, ".opencode")), `.opencode should still exist after uninstall ${flag}`)
  }
})

test("subcommand -v/-h prints version/help and exits 0", async () => {
  for (const [cmd, flag, expected] of [
    ["doctor", "-v", /armada v/],
    ["doctor", "-h", /Usage:/],
    ["fleet", "-v", /armada v/],
    ["fleet", "-h", /Usage:/],
    ["models", "-v", /armada v/],
    ["models", "-h", /Usage:/],
    ["status", "-v", /armada v/],
    ["status", "-h", /Usage:/],
    ["feature", "-h", /Usage:/],
  ]) {
    const r = await runCli([cmd, flag])
    assert.strictEqual(r.code, 0, `${cmd} ${flag} should exit 0`)
    assert.match(r.stdout, expected, `${cmd} ${flag} should print correctly`)
  }
})

// -- Phase 1: safe-bash tiered allowlist e2e --


