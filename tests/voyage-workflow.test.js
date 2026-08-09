import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { buildTeam, renderArmadaVoyageCommand } from "../src/generator.js"
import { modelFor, ROLES } from "../src/model-catalog.js"
import { makeTempGitRepo, resolvePermission, runCli } from "./helpers.js"

const root = fileURLToPath(new URL("..", import.meta.url))
const orchestratorPrompt = readFileSync(join(root, "agents", "orchestrator", "prompt.template.md"), "utf8")

const manifest = {
  project: {
    name: "workflow-test",
    budget: "balanced",
    browserTesting: false,
    devcontainer: false,
    useAgentBrowser: false,
  },
  team: ROLES.map((role) => ({ role, model: modelFor(role, "balanced"), enabled: true })),
  playbook: {},
}

test("main Commodore prompt embeds delivery mode and automatic voyage launch", () => {
  assert.match(orchestratorPrompt, /in-window first|in-window/i)
  assert.match(orchestratorPrompt, /voyage by exception|voyage/i)
  assert.match(orchestratorPrompt, /launch.*voyage|voyage.*launch/i)
  assert.match(orchestratorPrompt, /Do not implement voyage work in the main checkout/i)
})

test("main Commodore prompt makes autonomous multi-file work an automatic voyage", () => {
  assert.match(orchestratorPrompt, /multi-file implementation is voyage work/i)
  assert.match(orchestratorPrompt, /regardless of project size|regardless of.*low-risk|low risk.*does not downgrade/i)
  assert.match(orchestratorPrompt, /do it on your own.*routine|autonomy.*routine/i)
  assert.match(orchestratorPrompt, /does not.*bypass.*approval|does not.*replace.*contract approval/i)
  assert.match(orchestratorPrompt, /after approval.*launch.*automatically/i)
  assert.match(orchestratorPrompt, /do not ask.*second.*voyage|without.*second.*confirmation/i)
  assert.match(orchestratorPrompt, /background.*does not change.*execution mode/i)
})

test("main Commodore prompt does not depend on process triage document", () => {
  assert.doesNotMatch(orchestratorPrompt, /docs\/process\/triage\.md/)
})

test("voyage prompt assigns sandbox implementation ownership without re-triage", () => {
  const prompt = renderArmadaVoyageCommand()
  assert.match(prompt, /Voyage Commodore/i)
  assert.match(prompt, /sandbox/i)
  assert.match(prompt, /Do not re-triage|never re-triage/i)
  assert.match(prompt, /main checkout/i)
  assert.match(prompt, /implementation|phase gates|QA|PR/i)
})

test("orchestrator can run existing voyage setup commands but not arbitrary shell", () => {
  const orchestrator = buildTeam(manifest).find((agent) => agent.role === "orchestrator")
  const bash = orchestrator.permissions.bash
  assert.strictEqual(resolvePermission(bash, "armada feature new billing --worktree"), "allow")
  assert.strictEqual(resolvePermission(bash, "armada init --yes --target sandbox/billing"), "allow")
  assert.strictEqual(resolvePermission(bash, "armada voyage billing"), "allow")
  assert.strictEqual(resolvePermission(bash, "armada voyage-handoff billing"), "allow")
  assert.strictEqual(resolvePermission(bash, "rm -rf src"), "ask")
})

test("voyage prompt uses sandbox contract as implementation target", () => {
  const prompt = renderArmadaVoyageCommand()
  assert.match(prompt, /sandbox\/<name>\/armada\/REQUIREMENTS\.md/)
  assert.doesNotMatch(prompt, /co-write.*sandbox.*contract/i)
})

test("approved main contract initializes existing approval state", async () => {
  const { ensureApprovalState } = await import("../src/voyage/contract-snapshot.js")
  const { checkContractApproval } = await import("../src/voyage/contract-gate.js")
  const dir = makeTempGitRepo({
    "armada/REQUIREMENTS.md": "# Contract\n\nStatus: APPROVED\n",
  })

  const result = await ensureApprovalState(dir)

  assert.deepStrictEqual(result, { required: true, ok: true })
  assert.deepStrictEqual(checkContractApproval(dir), { ok: true, reason: null })
})

test("draft main contract blocks approval-state initialization", async () => {
  const { ensureApprovalState } = await import("../src/voyage/contract-snapshot.js")
  const dir = makeTempGitRepo({
    "armada/REQUIREMENTS.md": "# Contract\n\nStatus: DRAFT\n",
  })

  const result = await ensureApprovalState(dir)

  assert.strictEqual(result.required, true)
  assert.strictEqual(result.ok, false)
  assert.match(result.reason, /not approved|DRAFT/i)
})

test("draft voyage refuses before creating a sandbox", async () => {
  const dir = makeTempGitRepo({
    "armada/REQUIREMENTS.md": "# Contract\n\nStatus: DRAFT\n",
  })

  const result = await runCli(["voyage", "draft-voyage", "--no-open"], { cwd: dir })

  assert.strictEqual(result.code, 1)
  assert.match(result.stderr, /contract approval|not approved|DRAFT/i)
  assert.strictEqual(existsSync(join(dir, "sandbox", "draft-voyage")), false)
  rmSync(dir, { recursive: true, force: true })
})
