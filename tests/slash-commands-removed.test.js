import { test } from "node:test";
import assert from "node:assert";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { runCli } from "./helpers.js";
import { makeTempRepo } from "./helpers.js";

const manifestYaml = `
project:
  name: slash-test
  budget: free
  browserTesting: false
  devcontainer: false
  useAgentBrowser: false
  headless: false
  yolo: false
  requirementsFile: armada/REQUIREMENTS.md
  supervision:
    plugin: false
    fleet: false
  stack:
    frontend: null
    backend: null
    database: null
    testing: null
    srcDirs: [src]
    languages: [javascript]
    instructions: []
team:
  - role: orchestrator
    model: opencode-go/minimax-m3
    fallback: null
    enabled: true
`;

test("armada init --from-armada creates .opencode/commands/ directory", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml });
  const r = await runCli(["init", "--from-armada", "armada/armada.yaml", "--yes"], { cwd: dir });

  assert.strictEqual(r.code, 0, "init must succeed");
  const commandsDir = join(dir, ".opencode/commands");
  assert.ok(existsSync(commandsDir), `.opencode/commands/ must exist after scaffold (got: ${commandsDir})`);
  for (const cmd of ["armada", "armada-status", "armada-scout", "armada-resume", "armada-fleet", "armada-voyage"]) {
    assert.ok(existsSync(join(commandsDir, `${cmd}.md`)), `${cmd}.md must exist`);
  }

  rmSync(dir, { recursive: true, force: true });
});

test("armada help does NOT mention slash command entries", async () => {
  const r = await runCli(["help"]);

  assert.strictEqual(r.code, 0, "help must succeed");
  const slashPatterns = ["/armada-status", "/armada-scout", "/armada-resume", "/armada-fleet"];
  for (const p of slashPatterns) {
    assert.ok(!r.stdout.includes(p), `help output must NOT contain "${p}"`);
  }

  // CLI commands must be present
  assert.ok(r.stdout.includes("armada status"), "help must include 'armada status'");
  assert.ok(r.stdout.includes("armada scout"), "help must include 'armada scout'");
  assert.ok(r.stdout.includes("armada reconcile"), "help must include 'armada reconcile'");
  assert.ok(r.stdout.includes("armada fleet"), "help must include 'armada fleet'");
});
