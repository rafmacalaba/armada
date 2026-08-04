import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync, readdirSync, lstatSync, symlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { createHash } from "node:crypto"

import { makeTempRepo, runCli, spawnCli } from "./helpers.js"
import { parseRepoArg, validateTargetPaths } from "../src/update.js"
import { ROLES, modelFor } from "../src/model-catalog.js"
import { buildTeam, renderManifestYaml } from "../src/generator.js"

function manifestYaml() {
  const m = { project: { name: "update-e2e", budget: "free", browserTesting: false, devcontainer: false,
    useAgentBrowser: false, stack: {} },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "free"), fallback: null, enabled: true })) }
  return renderManifestYaml(m, buildTeam(m))
}

function hashFile(dir, rel) {
  return createHash("sha256").update(readFileSync(join(dir, rel), "utf8")).digest("hex")
}

// 1. Help text
test("update --help prints help text mentioning flags", async () => {
  const r = await runCli(["update", "--help"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /--yes/)
  assert.match(r.stdout, /--dry-run/)
  assert.match(r.stdout, /--repo/)
  assert.match(r.stdout, /bring an existing repo fully current/)
})

// 2. Missing armada/armada.yaml
test("update: missing manifest exits 1 with hint", async () => {
  const dir = makeTempRepo({})
  const r = await runCli(["update", "--repo", dir])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /armada\/armada\.yaml not found/)
  assert.match(r.stderr, /armada init/)
})

// 3. Unparseable opencode.json
test("update: unparseable opencode.json exits 1, file untouched", async () => {
  const dir = makeTempRepo({
    "armada/armada.yaml": manifestYaml(),
    "opencode.json": "{ this is not json }",
  })
  const originalHash = hashFile(dir, "opencode.json")
  const r = await runCli(["update", "--repo", dir])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /not valid JSON/)
  const afterHash = hashFile(dir, "opencode.json")
  assert.strictEqual(afterHash, originalHash, "opencode.json must be byte-identical")
})

// 4. Main success path: --yes updates default_agent + model, preserves user keys
test("update --yes: sets default_agent, updates model, preserves user keys", async () => {
  const userOc = {
    model: "opencode/hy3-free",
    $schema: "https://x",
    theme: "dark",
    mcp: { foo: "bar" },
  }
  const dir = makeTempRepo({
    "armada/armada.yaml": manifestYaml(),
    "opencode.json": JSON.stringify(userOc),
  })

  const r = await runCli(["update", "--yes", "--repo", dir])
  assert.strictEqual(r.code, 0, r.stderr)

  const updated = JSON.parse(readFileSync(join(dir, "opencode.json"), "utf8"))
  assert.strictEqual(updated.default_agent, "orchestrator")
  assert.notStrictEqual(updated.model, "opencode/hy3-free", "model must be updated from dead model")
  assert.ok(updated.model, "model must be set")
  assert.strictEqual(updated.$schema, "https://x")
  assert.strictEqual(updated.theme, "dark")
  assert.deepStrictEqual(updated.mcp, { foo: "bar" })
})

// 5. Idempotent re-run: second update produces identical opencode.json
test("update --yes: re-run is idempotent (opencode.json unchanged)", async () => {
  const userOc = {
    model: "opencode/hy3-free",
    $schema: "https://x",
    theme: "dark",
    mcp: { foo: "bar" },
  }
  const dir = makeTempRepo({
    "armada/armada.yaml": manifestYaml(),
    "opencode.json": JSON.stringify(userOc),
  })

  // First run
  const r1 = await runCli(["update", "--yes", "--repo", dir])
  assert.strictEqual(r1.code, 0, r1.stderr)

  // Check that armada-owned keys were set
  const after1 = JSON.parse(readFileSync(join(dir, "opencode.json"), "utf8"))
  assert.strictEqual(after1.default_agent, "orchestrator")
  assert.notStrictEqual(after1.model, "opencode/hy3-free")
  assert.ok(after1.model)

  const hash1 = hashFile(dir, "opencode.json")

  // Second run
  const r2 = await runCli(["update", "--yes", "--repo", dir])
  assert.strictEqual(r2.code, 0, r2.stderr)

  const hash2 = hashFile(dir, "opencode.json")
  assert.strictEqual(hash2, hash1, "opencode.json must be identical after second update")
})

// 6. --dry-run: prints plan, writes nothing
test("update --dry-run: prints plan, writes nothing", async () => {
  const userOc = {
    model: "opencode/hy3-free",
    $schema: "https://x",
    theme: "dark",
    mcp: { foo: "bar" },
  }
  const dir = makeTempRepo({
    "armada/armada.yaml": manifestYaml(),
    "opencode.json": JSON.stringify(userOc),
  })

  const originalHash = hashFile(dir, "opencode.json")

  const r = await runCli(["update", "--dry-run", "--repo", dir])
  assert.strictEqual(r.code, 0, r.stderr)
  assert.match(r.stdout, /armada update .+ plan/)
  assert.match(r.stdout, /opencode\.json changes/)
  assert.match(r.stdout, /\(dry-run\) No files written/)

  const afterHash = hashFile(dir, "opencode.json")
  assert.strictEqual(afterHash, originalHash, "opencode.json unchanged after dry-run")
})

// 7. Help output lists armada update
test("armada help lists update command", async () => {
  const r = await runCli(["help"])
  assert.strictEqual(r.code, 0)
  assert.match(r.stdout, /armada update/)
})

// ---- Phase 3: Interactive confirm + --dry-run/--yes semantics -----------

// 8. --dry-run: writes nothing, prints diff with default_agent, .opencode/ not created
test("update --dry-run: writes nothing, prints diff with default_agent, .opencode/ not created", async () => {
  const userOc = {
    model: "opencode/hy3-free",
    $schema: "https://x",
    theme: "dark",
    mcp: { foo: "bar" },
  }
  const dir = makeTempRepo({
    "armada/armada.yaml": manifestYaml(),
    "opencode.json": JSON.stringify(userOc),
  })

  const originalHash = hashFile(dir, "opencode.json")

  const r = await runCli(["update", "--dry-run", "--repo", dir])
  assert.strictEqual(r.code, 0, r.stderr)
  // stdout must contain the default_agent diff line
  assert.match(r.stdout, /default_agent/)
  assert.match(r.stdout, /\(dry-run\) No files written/)
  // SHA-256 identical before/after
  const afterHash = hashFile(dir, "opencode.json")
  assert.strictEqual(afterHash, originalHash, "opencode.json unchanged after dry-run")
  // .opencode/ directory NOT created (scaffold dry-run only, no write)
  const opencodeDir = join(dir, ".opencode")
  assert.strictEqual(existsSync(opencodeDir), false, ".opencode/ must not be created in dry-run")
})

// 9. --yes writes without prompting (no stdin required via closed stdin)
test("update --yes with closed stdin: writes without prompting, .opencode/ created", async () => {
  const userOc = {
    model: "opencode/hy3-free",
    $schema: "https://x",
    theme: "dark",
    mcp: { foo: "bar" },
  }
  const dir = makeTempRepo({
    "armada/armada.yaml": manifestYaml(),
    "opencode.json": JSON.stringify(userOc),
  })

  // stdin closed -> process.stdin.isTTY is false; --yes bypasses prompt anyway
  const r = await spawnCli(["update", "--yes", "--repo", dir], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.strictEqual(r.code, 0, r.stderr)

  const updated = JSON.parse(readFileSync(join(dir, "opencode.json"), "utf8"))
  assert.strictEqual(updated.default_agent, "orchestrator")
  assert.notStrictEqual(updated.model, "opencode/hy3-free", "model must be updated from dead model")
  assert.ok(updated.model, "model must be set")
  assert.strictEqual(updated.$schema, "https://x")
  assert.strictEqual(updated.theme, "dark")
  assert.deepStrictEqual(updated.mcp, { foo: "bar" })

  // .opencode/agent/ files exist
  const agentDir = join(dir, ".opencode", "agent")
  assert.strictEqual(existsSync(agentDir), true, ".opencode/agent/ must exist after --yes")
  const agentFiles = readdirSync(agentDir)
  assert.ok(agentFiles.length >= 8, `expected at least 8 agent files, got ${agentFiles.length}`)
})

// 10. Non-TTY stdin without --yes -> no write, warning printed, exit 0
test("update without --yes on non-TTY stdin: warns, writes nothing", async () => {
  const userOc = {
    model: "opencode/hy3-free",
    $schema: "https://x",
    theme: "dark",
    mcp: { foo: "bar" },
  }
  const dir = makeTempRepo({
    "armada/armada.yaml": manifestYaml(),
    "opencode.json": JSON.stringify(userOc),
  })

  const originalHash = hashFile(dir, "opencode.json")

  // Pipe stdin (non-TTY), no --yes, no --dry-run, no input fed
  const r = await spawnCli(["update", "--repo", dir], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  assert.strictEqual(r.code, 0, r.stderr)
  // Warning about non-interactive stdin
  assert.match(r.stdout, /stdin is not interactive|non.interactive/i)
  // opencode.json byte-unchanged
  const afterHash = hashFile(dir, "opencode.json")
  assert.strictEqual(afterHash, originalHash, "opencode.json must be unchanged on non-TTY without --yes")
})

// ---- Phase 5: Defect fixes (DEF-001 through DEF-007) -----------------------

// parseRepoArg unit tests

test("parseRepoArg: --repo value form", () => {
  const result = parseRepoArg(["--repo", "/tmp/x"], "/cwd")
  assert.strictEqual(result, "/tmp/x")
})

test("parseRepoArg: --repo=value equals form", () => {
  const result = parseRepoArg(["--repo=/tmp/x"], "/cwd")
  assert.strictEqual(result, "/tmp/x")
})

test("parseRepoArg: no --repo returns cwd", () => {
  const result = parseRepoArg([], "/cwd")
  assert.strictEqual(result, "/cwd")
})

test("parseRepoArg: --repo with no value throws", () => {
  assert.throws(() => {
    parseRepoArg(["--repo"], "/cwd")
  }, /requires a path argument/)
})

test("parseRepoArg: --repo with next arg starting with -- throws", () => {
  assert.throws(() => {
    parseRepoArg(["--repo", "--yes"], "/cwd")
  }, /requires a path argument/)
})

test("parseRepoArg: multiple --repo flags, last wins", () => {
  const result = parseRepoArg(["--repo", "/a", "--repo", "/b"], "/cwd")
  assert.strictEqual(result, "/b")
})

test("parseRepoArg: mixed forms, last positional wins", () => {
  const result = parseRepoArg(["--repo=/a", "--repo", "/b"], "/cwd")
  assert.strictEqual(result, "/b")
})

test("parseRepoArg: mixed forms, last equals wins", () => {
  const result = parseRepoArg(["--repo", "/a", "--repo=/b"], "/cwd")
  assert.strictEqual(result, "/b")
})

// validateTargetPaths unit tests

test("validateTargetPaths: normal files inside repo ok", () => {
  const dir = makeTempRepo({})
  const repo = resolve(dir)
  const ocPath = join(repo, "opencode.json")
  const armadaDir = join(repo, "armada")
  // opencode.json doesn't exist yet, armada/ doesn't exist → both ENFILE → ok
  assert.doesNotThrow(() => validateTargetPaths(repo, ocPath, armadaDir))
})

test("validateTargetPaths: existing regular files inside repo ok", () => {
  const dir = makeTempRepo({
    "opencode.json": "{}",
    "armada/armada.yaml": "x",
  })
  const repo = resolve(dir)
  const ocPath = join(repo, "opencode.json")
  const armadaDir = join(repo, "armada")
  assert.doesNotThrow(() => validateTargetPaths(repo, ocPath, armadaDir))
})

test("validateTargetPaths: symlink pointing outside throws", () => {
  const dir = makeTempRepo({})
  const repo = resolve(dir)
  const outsidePath = join(resolve(dir, ".."), "outside.txt")
  writeFileSync(outsidePath, "victim", "utf8")
  const ocPath = join(repo, "opencode.json")
  symlinkSync(outsidePath, ocPath)
  try {
    assert.throws(() => {
      validateTargetPaths(repo, ocPath, join(repo, "armada"))
    }, /opencode.json is a symlink that points outside/)
  } finally {
    rmSync(outsidePath, { force: true })
  }
})

test("validateTargetPaths: symlink pointing inside repo ok", () => {
  const dir = makeTempRepo({})
  const repo = resolve(dir)
  const insideTarget = join(repo, "real-config.json")
  writeFileSync(insideTarget, "{}", "utf8")
  const ocPath = join(repo, "opencode.json")
  symlinkSync(insideTarget, ocPath)
  assert.doesNotThrow(() => validateTargetPaths(repo, ocPath, join(repo, "armada")))
})

// CLI e2e: --repo=value --dry-run targets correct repo

test("update --repo=value --dry-run: targets correct repo", async () => {
  const userOc = { model: "opencode/hy3-free", theme: "dark" }
  const dir = makeTempRepo({
    "armada/armada.yaml": manifestYaml(),
    "opencode.json": JSON.stringify(userOc),
  })
  const r = await runCli(["update", `--repo=${dir}`, "--dry-run"])
  assert.strictEqual(r.code, 0, r.stderr)
  assert.match(r.stdout, /default_agent/)
  assert.match(r.stdout, /\(dry-run\) No files written/)
})

// CLI e2e: --repo with no value

test("update --repo (no value): exits 1, stderr mentions requires a path", async () => {
  const r = await runCli(["update", "--repo"])
  assert.strictEqual(r.code, 1, r.stderr)
  assert.match(r.stderr, /requires a path argument/)
})

// CLI e2e: non-object opencode.json

test("update with array opencode.json: exits 1, file byte-unchanged, mentions JSON object", async () => {
  const dir = makeTempRepo({
    "armada/armada.yaml": manifestYaml(),
    "opencode.json": JSON.stringify(["not", "an", "object"]),
  })
  const originalContent = readFileSync(join(dir, "opencode.json"), "utf8")
  const r = await runCli(["update", "--yes", "--repo", dir])
  assert.strictEqual(r.code, 1, r.stderr)
  assert.match(r.stderr, /JSON object/)
  const afterContent = readFileSync(join(dir, "opencode.json"), "utf8")
  assert.strictEqual(afterContent, originalContent, "opencode.json byte-unchanged")
})

// CLI e2e: --yes adds .gitignore block when missing

test("update --yes on repo without .gitignore: block added", async () => {
  const userOc = { model: "opencode/hy3-free", theme: "dark" }
  const dir = makeTempRepo({
    "armada/armada.yaml": manifestYaml(),
    "opencode.json": JSON.stringify(userOc),
  })
  // Ensure no .gitignore
  assert.strictEqual(existsSync(join(dir, ".gitignore")), false)
  const r = await runCli(["update", "--yes", "--repo", dir])
  assert.strictEqual(r.code, 0, r.stderr)
  const gi = readFileSync(join(dir, ".gitignore"), "utf8")
  assert.match(gi, /# armada:start/)
  assert.match(gi, /# armada:end/)
})

// CLI e2e: symlink opencode.json escaping repo rejected

test("update --yes with symlink opencode.json outside repo: exits 1", async () => {
  const dir = makeTempRepo({
    "armada/armada.yaml": manifestYaml(),
  })
  const repo = resolve(dir)
  const outsidePath = join(resolve(dir, ".."), "victim.json")
  writeFileSync(outsidePath, '{"theme":"light"}', "utf8")
  const ocPath = join(repo, "opencode.json")
  symlinkSync(outsidePath, ocPath)
  try {
    const r = await runCli(["update", "--yes", "--repo", repo])
    assert.strictEqual(r.code, 1, r.stderr)
    const victimContent = readFileSync(outsidePath, "utf8")
    assert.strictEqual(victimContent, '{"theme":"light"}', "victim file untouched")
  } finally {
    rmSync(outsidePath, { force: true })
  }
})
