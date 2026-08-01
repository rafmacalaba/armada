# Armada Standalone Test Harness + Capability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove armada works standalone (CLI e2e, round-trip, fixtures, dogfood) and harden real gaps (YAML parser, `doctor`, `models --refresh`, `--dry-run`, `--yes`, `uninstall`).

**Architecture:** TDD task-by-task, one file/responsibility each. Pure logic in `src/`, spawn-dependent logic isolated in `src/doctor.js` + `model-catalog.js` (bin resolved via PATH, so tests inject fake `opencode` scripts). Harness spawns real `node src/cli.js`.

**Tech Stack:** node >=20 ESM, `node:test`, `node:child_process`, `yaml` (only new runtime dep).

## Global Constraints

- Keep existing 19 unit tests green; `node --test 'tests/*.test.js'` is the verify command
- Questionnaire stays zero-dep; `yaml` is the only new runtime dependency
- No-clobber contract: never overwrite user `opencode.json` / `AGENTS.md` / `REQUIREMENTS.md`
- All fake `opencode` bins are `#!/bin/sh` scripts, chmod 0o755, injected via PATH
- Binaries (including this repo's own opencode) resolved through PATH — no hardcoded paths

---

### Task 1: Real YAML manifest parser

**Files:**
- Modify: `src/manifest.js`
- Create: `tests/manifest.test.js`

**Interfaces:**
- Produces: `parseManifestYaml(text: string) -> { project: { name, budget, browserTesting, devcontainer, useAgentBrowser, stack: { frontend, backend, database, testing, srcDirs, languages, instructions } }, team: [{ role, model, fallback, enabled }], playbook: object }` — throws `Error` on invalid YAML / missing `project` / empty `team`

- [ ] **Step 1: Write failing tests** (`tests/manifest.test.js`)

```js
import { test } from "node:test"
import assert from "node:assert"
import { parseManifestYaml } from "../src/manifest.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../src/generator.js"

function makeManifest() {
  return {
    project: {
      name: "t", budget: "balanced", browserTesting: false,
      devcontainer: false, useAgentBrowser: false,
      stack: { frontend: "nextjs", backend: "python-fastapi", database: "postgres",
        testing: "playwright", srcDirs: ["src", "backend"], languages: ["typescript", "python"] },
    },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "balanced"), fallback: null, enabled: true })),
    playbook: {},
  }
}

test("round-trips through renderManifestYaml", () => {
  const m = makeManifest()
  const parsed = parseManifestYaml(renderManifestYaml(m, buildTeam(m)))
  assert.strictEqual(parsed.project.name, "t")
  assert.strictEqual(parsed.project.budget, "balanced")
  assert.strictEqual(parsed.project.stack.backend, "python-fastapi")
  assert.strictEqual(parsed.project.stack.srcDirs.length, 2)
  assert.strictEqual(parsed.team.length, ROLES.length)
  assert.ok(parsed.team.every((t) => t.enabled === true))
})

test("parses null stack fields", () => {
  const m = makeManifest()
  m.project.stack = {}
  const parsed = parseManifestYaml(renderManifestYaml(m, buildTeam(m)))
  assert.strictEqual(parsed.project.stack.frontend, null)
})

test("rejects invalid yaml", () => {
  assert.throws(() => parseManifestYaml("project: [unclosed"), Error)
})

test("rejects missing team", () => {
  assert.throws(() => parseManifestYaml("project:\n  name: x\n  budget: balanced\nteam: []"), /team is empty/)
})
```

- [ ] **Step 2: Run, verify fail** — `node --test tests/manifest.test.js` → FAIL (`parseManifestYaml is not a function`)
- [ ] **Step 3: Implement** — add to `src/manifest.js`:

```js
import YAML from "yaml"

export function parseManifestYaml(text) {
  let raw
  try {
    raw = YAML.parse(text)
  } catch (err) {
    throw new Error(`armada.yaml: invalid YAML (${err.message})`)
  }
  if (!raw || !raw.project) throw new Error("armada.yaml: missing 'project' section")
  const p = raw.project
  const stack = p.stack ?? {}
  const team = (raw.team ?? []).map((t) => ({
    role: t.role,
    model: t.model,
    fallback: t.fallback,
    enabled: t.enabled !== false,
  }))
  if (!team.length) throw new Error("armada.yaml: team is empty")
  return {
    project: {
      name: p.name ?? "project",
      budget: p.budget ?? "balanced",
      browserTesting: p.browserTesting ?? false,
      devcontainer: p.devcontainer ?? false,
      useAgentBrowser: p.useAgentBrowser ?? false,
      stack: {
        frontend: stack.frontend ?? null,
        backend: stack.backend ?? null,
        database: stack.database ?? null,
        testing: stack.testing ?? null,
        srcDirs: stack.srcDirs ?? [],
        languages: stack.languages ?? [],
        instructions: stack.instructions ?? [],
      },
    },
    team,
    playbook: raw.playbook ?? {},
  }
}
```

- [ ] **Step 4: Run, verify pass** — `node --test tests/manifest.test.js` → PASS (4)
- [ ] **Step 5: Install dep** — `npm install yaml@^2.7.0`
- [ ] **Step 6: Commit** — `git add package.json package-lock.json src/manifest.js tests/manifest.test.js && git commit -m "feat: real YAML manifest parser (yaml dep) with round-trip tests"`

---

### Task 2: `scaffold` dry-run + `uninstall`

**Files:**
- Modify: `src/scaffold.js`
- Modify: `tests/scaffold.test.js`

**Interfaces:**
- Consumes: `scaffold(manifest, stack)` (existing)
- Produces: `scaffold(manifest, stack, opts?: { dryRun?: boolean }) -> string[]` (dryRun: computes + returns paths, writes nothing, but still respects existsSync guards); `uninstall(manifest, opts?: { all?: boolean }) -> string[]` (removes `armada.yaml`, `.opencode`, `.devcontainer`; with `all: true` also `AGENTS.md`, `opencode.json`, `REQUIREMENTS.md`; never removes user files without `all`)

- [ ] **Step 1: Write failing tests** (append to `tests/scaffold.test.js`; reuse its `makeManifest`):

```js
import { uninstall } from "../src/scaffold.js"

test("scaffold dryRun writes nothing but lists files", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-dry-"))
  const manifest = makeManifest(dir)
  const files = scaffold(manifest, manifest.project.stack, { dryRun: true })
  assert.ok(files.includes("armada.yaml"))
  assert.ok(files.includes(".opencode/oh-my-opencode-slim.jsonc"))
  assert.ok(!existsSync(join(dir, "armada.yaml")))
  assert.ok(!existsSync(join(dir, ".opencode")))
  rmSync(dir, { recursive: true, force: true })
})

test("uninstall removes armada files, keeps user files", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-uni-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  writeFileSync(join(dir, "AGENTS.md"), "# custom")
  const removed = uninstall(manifest)
  assert.ok(!existsSync(join(dir, "armada.yaml")))
  assert.ok(!existsSync(join(dir, ".opencode")))
  assert.ok(existsSync(join(dir, "AGENTS.md")))
  assert.ok(!removed.includes("AGENTS.md"))
  rmSync(dir, { recursive: true, force: true })
})

test("uninstall --all also removes generated user-facing files", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-uni2-"))
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  const removed = uninstall(manifest, { all: true })
  assert.ok(removed.includes("AGENTS.md"))
  assert.ok(removed.includes("opencode.json"))
  rmSync(dir, { recursive: true, force: true })
})
```

- [ ] **Step 2: Run, verify fail** — `node --test tests/scaffold.test.js` → FAIL (dryRun writes anyway; `uninstall` undefined)
- [ ] **Step 3: Implement** in `src/scaffold.js` — change `scaffold(manifest, stack, opts = {})`, guard `write` and `copyFileSync` with `if (!opts.dryRun)`, and add:

```js
export function uninstall(manifest, opts = {}) {
  const target = manifest?.targetDir || "."
  const removed = []
  const rm = (rel) => {
    const full = join(target, rel)
    if (existsSync(full)) {
      if (!opts.dryRun) rmSync(full, { recursive: true, force: true })
      removed.push(rel)
    }
  }
  rm("armada.yaml")
  rm(".opencode")
  rm(".devcontainer")
  if (opts.all) {
    rm("AGENTS.md")
    rm("opencode.json")
    rm("REQUIREMENTS.md")
  }
  return removed
}
```

- [ ] **Step 4: Run, verify pass** — `node --test tests/scaffold.test.js` → PASS (existing 3 + new 3)
- [ ] **Step 5: Commit** — `git add src/scaffold.js tests/scaffold.test.js && git commit -m "feat: scaffold --dry-run and uninstall command support"`

---

### Task 3: CLI `init` flags (`--yes`, `--dry-run`) + parser wiring

**Files:**
- Modify: `src/cli.js`
- Create: `tests/helpers.js`, `tests/cli.test.js`

**Interfaces:**
- Consumes: `parseManifestYaml` (Task 1), `scaffold(..., { dryRun })` (Task 2), `guessName` from `questionnaire.js`, `ROLES`/`modelFor` from `model-catalog.js`
- Produces: `init` accepts `--yes` (skip questionnaire when non-TTY or flagged), `--dry-run` (print preview, no write); the regex `parseManifest` is deleted

- [ ] **Step 1: Write helpers + failing tests** (`tests/helpers.js`):

```js
import { mkdtempSync, writeFileSync, mkdirSync, chmodSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFile } from "node:child_process"

const CLI = join(process.cwd(), "src/cli.js")

export function makeTempRepo(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "armada-e2e-"))
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel)
    mkdirSync(join(dir, rel.split("/").slice(0, -1).join("/")), { recursive: true })
    writeFileSync(p, content, "utf8")
  }
  return dir
}

export function makeBin(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "armada-bin-"))
  for (const [name, content] of Object.entries(files)) {
    const p = join(dir, name)
    writeFileSync(p, content, "utf8")
    chmodSync(p, 0o755)
  }
  return dir
}

export function runCli(args, opts = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env, ...(opts.env || {}) }
    execFile(process.execPath, [CLI, ...args], { cwd: opts.cwd || process.cwd(), env },
      (err, stdout, stderr) => resolve({ code: err?.code ?? 0, stdout, stderr }))
  })
}
```

(`tests/cli.test.js`):

```js
import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../src/generator.js"
import { runCli, makeTempRepo } from "./helpers.js"

function manifestYaml() {
  const m = { project: { name: "e2e", budget: "free", browserTesting: false, devcontainer: false,
    useAgentBrowser: false, stack: {} },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "free"), fallback: null, enabled: true })) }
  return renderManifestYaml(m, buildTeam(m))
}

test("ping returns ok", async () => {
  const r = await runCli(["ping"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /armada ok/)
})

test("init --from-armada scaffolds full team", async () => {
  const dir = makeTempRepo({ "armada.yaml": manifestYaml() })
  const r = await runCli(["init", "--from-armada", "armada.yaml"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  for (const f of ["armada.yaml", "opencode.json", "AGENTS.md", "REQUIREMENTS.md",
    ".opencode/oh-my-opencode-slim.jsonc", ".opencode/commands/armada.md"])
    assert.ok(existsSync(join(dir, f)), `missing ${f}`)
})

test("init --dry-run writes nothing", async () => {
  const dir = makeTempRepo({ "armada.yaml": manifestYaml() })
  const r = await runCli(["init", "--from-armada", "armada.yaml", "--dry-run"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /dry-run/)
  assert.ok(!existsSync(join(dir, ".opencode")))
})

test("init --yes --budget free --no-browser works without TTY", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--yes", "--budget", "free", "--no-browser"], { cwd: dir })
  assert.strictEqual(r.code, 0)
  const yaml = readFileSync(join(dir, "armada.yaml"), "utf8")
  assert.match(yaml, /budget: free/)
  assert.match(yaml, /browserTesting: false/)
})

test("init --from-armada missing manifest exits 1", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["init", "--from-armada", "nope.yaml"], { cwd: dir })
  assert.strictEqual(r.code, 1)
})
```

- [ ] **Step 2: Run, verify fail** — `node --test tests/cli.test.js` → FAIL (`init` still asks questionnaire without TTY; `--dry-run` writes)
- [ ] **Step 3: Implement** in `src/cli.js`:
  - Replace regex `parseManifest` (cli.js:151-175) with `import { parseManifestYaml } from "./manifest.js"`
  - Add `defaultManifest()` using `guessName(process.cwd())` + all roles at `modelFor(role, "balanced")`
  - In `init`: `const nonInteractive = args.includes("--yes") || !process.stdin.isTTY;` → if no `--from-armada` and nonInteractive use `defaultManifest()`, else questionnaire. After building manifest apply existing `--budget`/`--stack`/`--no-browser` overrides; then `const dryRun = args.includes("--dry-run")`; print `(dry-run) + {f}` per file when set; when `--from-armada`, call `parseManifestYaml` (now throws → catch, `console.error`, exit 1)

- [ ] **Step 4: Run, verify pass** — `node --test tests/cli.test.js` → PASS (5)
- [ ] **Step 5: Commit** — `git add src/cli.js tests/helpers.js tests/cli.test.js && git commit -m "feat: init --yes/--dry-run, real manifest parser in CLI"`

---

### Task 4: Real `doctor`

**Files:**
- Create: `src/doctor.js`
- Modify: `src/cli.js`
- Create: `tests/doctor.test.js`

**Interfaces:**
- Produces: `runDoctor(opts?: { configPath?: string, env?: object }) -> Promise<[{ name, status: "pass"|"warn"|"fail", detail }]>` — spawns `opencode --version`, `opencode providers list`, reads `plugin[]` from config, checks env flag, reports node version

- [ ] **Step 1: Write failing tests** (`tests/doctor.test.js`):

```js
import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runDoctor } from "../src/doctor.js"
import { makeBin } from "./helpers.js"

const SH = "#!/bin/sh\ncase \"$1\" in\n  --version) echo 1.18.11 ;;\n  *) echo ok ;;\nesac\n"

function envWith(binDir, extra = {}) {
  return { ...process.env, PATH: `${binDir}:${process.env.PATH}`, ...extra }
}

test("all checks pass on healthy env", async () => {
  const binDir = makeBin({ opencode: SH })
  const cfgDir = mkdtempSync(join(tmpdir(), "armada-cfg-"))
  writeFileSync(join(cfgDir, "opencode.json"),
    JSON.stringify({ plugin: ["./plugins/oh-my-opencode-slim/plugin.js"] }))
  const checks = await runDoctor({
    configPath: join(cfgDir, "opencode.json"),
    env: envWith(binDir, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" }),
  })
  assert.deepStrictEqual(checks.map((c) => c.status), ["pass", "pass", "pass", "pass", "pass"])
})

test("fails when omo-slim plugin missing", async () => {
  const binDir = makeBin({ opencode: SH })
  const cfgDir = mkdtempSync(join(tmpdir(), "armada-cfg-"))
  writeFileSync(join(cfgDir, "opencode.json"), JSON.stringify({ plugin: [] }))
  const checks = await runDoctor({
    configPath: join(cfgDir, "opencode.json"),
    env: envWith(binDir, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" }),
  })
  const plugin = checks.find((c) => c.name === "omo-slim plugin")
  assert.strictEqual(plugin.status, "fail")
})

test("warns when background subagents flag unset", async () => {
  const binDir = makeBin({ opencode: SH })
  const cfgDir = mkdtempSync(join(tmpdir(), "armada-cfg-"))
  writeFileSync(join(cfgDir, "opencode.json"), JSON.stringify({ plugin: ["x"] }))
  const checks = await runDoctor({ configPath: join(cfgDir, "opencode.json"), env: envWith(binDir) })
  const bg = checks.find((c) => c.name === "background subagents")
  assert.strictEqual(bg.status, "warn")
})

test("fails when opencode missing", async () => {
  const empty = mkdtempSync(join(tmpdir(), "armada-nobin-"))
  const checks = await runDoctor({ configPath: "/nonexistent.json", env: envWith(empty) })
  assert.strictEqual(checks.find((c) => c.name === "opencode CLI").status, "fail")
})
```

- [ ] **Step 2: Run, verify fail** — `node --test tests/doctor.test.js` → FAIL (`runDoctor is not a function`)
- [ ] **Step 3: Implement** (`src/doctor.js`):

```js
import { execFile } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

function run(bin, args, env) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 15000, env }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: `${stdout ?? ""}${stderr ?? ""}`.trim() }))
  })
}

export async function runDoctor(opts = {}) {
  const env = opts.env || process.env
  const configPath = opts.configPath || join(homedir(), ".config/opencode/opencode.json")
  const checks = []

  const v = await run("opencode", ["--version"], env)
  checks.push({ name: "opencode CLI", status: v.ok ? "pass" : "fail", detail: v.ok ? v.out : "not found on PATH" })

  const auth = await run("opencode", ["providers", "list"], env)
  checks.push({ name: "providers auth", status: auth.ok ? "pass" : "fail", detail: auth.ok ? "logged in" : "no providers configured" })

  let plugin = "missing"
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf8")
        .replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")
      const cfg = JSON.parse(raw)
      const plugins = cfg.plugin || []
      plugin = plugins.some((p) => String(p).includes("oh-my-opencode-slim")) ? "present" : "missing"
    } catch {
      plugin = "unparseable"
    }
  }
  checks.push({ name: "omo-slim plugin", status: plugin === "present" ? "pass" : "fail", detail: `plugin[] ${plugin}` })

  const bg = env.OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS
  checks.push({
    name: "background subagents",
    status: bg === "true" ? "pass" : "warn",
    detail: bg === "true" ? "enabled" : "set OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true",
  })

  checks.push({ name: "node", status: "pass", detail: process.version })
  return checks
}
```

- [ ] **Step 4: Wire CLI** in `src/cli.js` — `doctor()` becomes async, runs `runDoctor()`, prints `name: status — detail` per check, sets `process.exitCode = 1` if any `fail`
- [ ] **Step 5: Run, verify pass** — `node --test tests/doctor.test.js` → PASS (4)
- [ ] **Step 6: Commit** — `git add src/doctor.js src/cli.js tests/doctor.test.js && git commit -m "feat: real armada doctor with spawn checks + exit codes"`

---

### Task 5: Real `models --refresh`

**Files:**
- Modify: `src/model-catalog.js`
- Modify: `src/cli.js`
- Create: `tests/models-refresh.test.js`

**Interfaces:**
- Consumes: `renderCatalog(budget)` (existing)
- Produces: `refreshModels(opts?: { cachePath?: string, env?: object }) -> Promise<Set<string>>` (spawns `opencode models`, caches JSON to `~/.armada/models.cache.json` by default); `loadModelsCache(cachePath?) -> Set<string>|null`; `renderCatalog(budget, availability?: Set<string>|null)` (prefixes `✓`/`✗` when availability provided; backward compatible)

- [ ] **Step 1: Write failing tests** (`tests/models-refresh.test.js`):

```js
import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { refreshModels, loadModelsCache, renderCatalog } from "../src/model-catalog.js"
import { makeBin } from "./helpers.js"

const MODELS_SH = "#!/bin/sh\necho \"opencode/big-pickle\nopencode/mimo-v2.5-free\nopencode-go/kimi-k2.7-code\"\n"

function envWith(binDir) { return { ...process.env, PATH: `${binDir}:${process.env.PATH}` } }

test("refreshModels parses output and caches", async () => {
  const binDir = makeBin({ opencode: MODELS_SH })
  const cache = join(mkdtempSync(join(tmpdir(), "armada-cache-")), "models.cache.json")
  const available = await refreshModels({ cachePath: cache, env: envWith(binDir) })
  assert.ok(available.has("opencode/big-pickle"))
  assert.ok(loadModelsCache(cache).has("opencode/mimo-v2.5-free"))
})

test("renderCatalog marks availability", () => {
  const out = renderCatalog("free", new Set(["opencode/big-pickle"]))
  assert.match(out, /✓opencode\/big-pickle/)
  assert.match(out, /✗/)
})

test("loadModelsCache returns null on missing cache", () => {
  assert.strictEqual(loadModelsCache("/nonexistent/cache.json"), null)
})
```

- [ ] **Step 2: Run, verify fail** — `node --test tests/models-refresh.test.js` → FAIL (`refreshModels is not a function`)
- [ ] **Step 3: Implement** in `src/model-catalog.js`:

```js
import { execFile } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join, dirname } from "node:path"

export function defaultCachePath() {
  return join(homedir(), ".armada", "models.cache.json")
}

export function loadModelsCache(cachePath = defaultCachePath()) {
  try {
    const c = JSON.parse(readFileSync(cachePath, "utf8"))
    return Array.isArray(c.models) ? new Set(c.models) : null
  } catch {
    return null
  }
}

export async function refreshModels(opts = {}) {
  const env = opts.env || process.env
  const cachePath = opts.cachePath || defaultCachePath()
  const out = await new Promise((res, rej) =>
    execFile("opencode", ["models"], { timeout: 30000, env }, (err, stdout) =>
      err ? rej(new Error(`opencode models failed: ${err.message}`)) : res(stdout)))
  const models = out.split("\n").map((s) => s.trim()).filter(Boolean)
  mkdirSync(dirname(cachePath), { recursive: true })
  writeFileSync(cachePath, JSON.stringify({ updatedAt: new Date().toISOString(), models }, null, 2))
  return new Set(models)
}
```

Change `renderCatalog`:

```js
export function renderCatalog(budget = "balanced", availability = null) {
  const rows = ROLES.map((role) => {
    const e = CATALOG[role]
    const primary = modelFor(role, budget)
    const mark = availability ? (availability.has(primary) ? "✓" : "✗") : ""
    return [role.padEnd(14), `${mark}${primary}`.padEnd(38), e.fallback || ""]
  })
  const header = ["role".padEnd(14), "model".padEnd(38), "fallback"]
  return [header.join("  "), rows.map((r) => r.join("  ")).join("\n")].join("\n")
}
```

- [ ] **Step 4: Wire CLI** in `src/cli.js` — `models()` becomes async; read `--cache <path>`; if `--refresh` → `availability = await refreshModels({ cachePath })` (catch → stderr + exit 1); else `availability = loadModelsCache(cachePath)`; print header + `renderCatalog(budget, availability)`
- [ ] **Step 5: Run, verify pass** — `node --test tests/models-refresh.test.js` → PASS (3)
- [ ] **Step 6: Commit** — `git add src/model-catalog.js src/cli.js tests/models-refresh.test.js && git commit -m "feat: real models --refresh with availability markers + cache"`

---

### Task 6: Round-trip, fixtures, dogfood test suite

**Files:**
- Create: `tests/roundtrip.test.js`, `tests/dogfood.test.js`, `tests/fixtures.test.js`
- Create: `tests/fixtures/nextjs-monorepo/{package.json,docker-compose.yml}`, `tests/fixtures/fastapi/{requirements.txt,Dockerfile}`, `tests/fixtures/empty/.gitkeep`
- Modify: `tests/cli.test.js` (add `models --refresh` e2e with fake bin)

**Interfaces:**
- Consumes: `parseManifestYaml`, `scaffold`, `buildTeam`/`renderManifestYaml`, `detectStack`, `runCli`

- [ ] **Step 1: Write round-trip test** (`tests/roundtrip.test.js`):

```js
import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, readFileSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { scaffold } from "../src/scaffold.js"
import { parseManifestYaml } from "../src/manifest.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../src/generator.js"

function manifest(dir) {
  const m = { targetDir: dir, project: { name: "rt", budget: "power", browserTesting: true,
    devcontainer: true, useAgentBrowser: true,
    stack: { frontend: "nextjs", backend: "python-fastapi", database: "postgres", testing: "playwright",
      srcDirs: ["src", "backend"], languages: ["typescript", "python"] } },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "power"), fallback: null, enabled: true })) }
  return { m, yaml: renderManifestYaml(m, buildTeam(m)) }
}

function listFiles(dir) {
  const out = []
  const walk = (p) => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const f = join(p, e.name)
      if (e.isDirectory()) walk(f)
      else out.push(f.slice(dir.length + 1))
    }
  }
  walk(dir)
  return out.sort()
}

test("init -> parse -> init produces identical file tree and contents", () => {
  const d1 = mkdtempSync(join(tmpdir(), "armada-rt-"))
  const { m, yaml } = manifest(d1)
  scaffold(m, m.project.stack)
  const parsed = parseManifestYaml(yaml)
  const d2 = mkdtempSync(join(tmpdir(), "armada-rt-"))
  scaffold({ ...parsed, targetDir: d2 }, parsed.project.stack)
  const a = listFiles(d1)
  const b = listFiles(d2)
  assert.deepStrictEqual(a, b)
  for (const f of a) {
    const ra = readFileSync(join(d1, f), "utf8")
    const rb = readFileSync(join(d2, f), "utf8")
    assert.strictEqual(ra, rb, `differs: ${f}`)
  }
})
```

- [ ] **Step 2: Write dogfood test** (`tests/dogfood.test.js`):

```js
import { test } from "node:test"
import assert from "node:assert"
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { scaffold } from "../src/scaffold.js"
import { ROLES, modelFor } from "../src/model-catalog.js"

const OUR_AGENTS = join(process.cwd(), "AGENTS.md")
const OUR_CLAUDE = join(process.cwd(), "CLAUDE.md")

test("dogfood: scaffold over this repo's instruction files preserves them", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-dogfood-"))
  writeFileSync(join(dir, "AGENTS.md"), readFileSync(OUR_AGENTS, "utf8"))
  writeFileSync(join(dir, "CLAUDE.md"), readFileSync(OUR_CLAUDE, "utf8"))
  writeFileSync(join(dir, "opencode.json"), "{\"custom\":true}\n")
  const m = {
    targetDir: dir,
    project: { name: "armada", budget: "balanced", browserTesting: false, devcontainer: false,
      useAgentBrowser: false, stack: {} },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "balanced"), fallback: null, enabled: true })),
  }
  scaffold(m, {})
  assert.strictEqual(readFileSync(join(dir, "CLAUDE.md"), "utf8"), readFileSync(OUR_CLAUDE, "utf8"))
  assert.strictEqual(readFileSync(join(dir, "AGENTS.md"), "utf8"), readFileSync(OUR_AGENTS, "utf8"))
  assert.strictEqual(JSON.parse(readFileSync(join(dir, "opencode.json"), "utf8")).custom, true)
})
```

- [ ] **Step 3: Write fixtures + test** — create fixture files, then `tests/fixtures.test.js`:

```js
import { test } from "node:test"
import assert from "node:assert"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { detectStack } from "../src/stack-detect.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

test("detectStack over fixture corpus", () => {
  const cases = [
    ["nextjs-monorepo", { frontend: "nextjs", testing: "jest", database: "postgres" }],
    ["fastapi", { backend: "python-fastapi", testing: "pytest" }],
    ["empty", {}],
  ]
  for (const [name, expect] of cases) {
    const s = detectStack(join(FIXTURES, name))
    for (const [k, v] of Object.entries(expect)) assert.strictEqual(s[k], v, `${name}.${k}`)
  }
})
```

Fixture contents:
- `fixtures/nextjs-monorepo/package.json`: `{"dependencies":{"next":"15","react":"19"},"devDependencies":{"jest":"29"}}`
- `fixtures/nextjs-monorepo/docker-compose.yml`: `services:\n  db:\n    image: postgres:16\n`
- `fixtures/fastapi/requirements.txt`: `fastapi\nuvicorn\npytest\n`
- `fixtures/fastapi/Dockerfile`: `FROM python:3.12\n`
- `fixtures/empty/.gitkeep`: empty

- [ ] **Step 4: Add CLI `models --refresh` e2e** to `tests/cli.test.js`:

```js
test("models --refresh merges availability via fake opencode", async () => {
  const binDir = makeBin({ opencode: "#!/bin/sh\necho \"opencode/big-pickle\nopencode/mimo-v2.5-free\"\n" })
  const cache = join(makeTempRepo({}), "cache.json")
  const r = await runCli(["models", "--refresh", "--cache", cache], { env: { PATH: `${binDir}:${process.env.PATH}` } })
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /✓/)
  assert.match(r.stdout, /✗/)
})
```

- [ ] **Step 5: Run all** — `node --test 'tests/*.test.js'` → PASS (existing 19 + new ~13)
- [ ] **Step 6: Commit** — `git add tests/ && git commit -m "test: round-trip, dogfood, fixture corpus, models --refresh e2e"`

---

### Task 7: Docs + full verification + manual smoke

**Files:**
- Modify: `docs/validation.md`, `TODO.md`, `README.md`, `CLAUDE.md`

- [ ] **Step 1: Update docs**
  - `README.md` CLI table: add `uninstall`, `init --dry-run`, `init --yes`, `models --cache <path>`
  - `TODO.md`: check off YAML parser, `doctor`, `models --refresh`, `--dry-run`/`--yes`/`uninstall`; note standalone harness
  - `docs/validation.md`: append standalone-harness result (CLI e2e + round-trip + dogfood, 19→~32 tests)
  - `CLAUDE.md`: update Current state + Next task
- [ ] **Step 2: Full suite** — `node --test 'tests/*.test.js'` → all pass
- [ ] **Step 3: Manual smoke** (scratch dir):

```bash
node src/cli.js help
node src/cli.js models --refresh --cache /tmp/armada-cache.json
node src/cli.js doctor
node src/cli.js init --from-armada <scratch>/armada.yaml --dry-run
node src/cli.js uninstall
```

Confirm: doctor reports omo-slim missing (expected on this machine), exit code reflects; `models --refresh` shows ✓/✗; dry-run writes nothing
- [ ] **Step 4: Commit** — `git add docs README.md TODO.md CLAUDE.md && git commit -m "docs: record standalone harness validation + roadmap progress"`
