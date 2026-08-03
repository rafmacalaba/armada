# Native Mode (Drop omo-slim) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the omo-slim runtime dependency with fully-native opencode teams — `.opencode/agent/*.md` files, minimal `opencode.json`, self-contained orchestrator prompt, native background dispatch.

**Architecture:** `generator.js` stops emitting the omo-slim `.jsonc` and instead renders one `.opencode/agent/<role>.md` per enabled role (YAML frontmatter carries `description`/`mode`/`model`/`variant`/`permission`/`color`; body is the filled prompt). `opencode.json` shrinks to `model` + `external_directory: deny` + `default_agent: "orchestrator"`. `scaffold.js` writes the agent files and prunes stale omo-slim artifacts; `uninstall` removes only armada-written role files. `doctor.js` drops plugin checks. The orchestrator prompt is merged into one self-contained template.

**Tech Stack:** Node ≥ 20 (ESM, explicit `.js` imports), `yaml` (only runtime dep, already used for manifest parsing — reused for frontmatter), `node:test`.

## Global Constraints

- ESM everywhere; imports use explicit `.js` extensions. Node >= 20.
- `yaml` is the only runtime dependency.
- Generator is pure (zero I/O); scaffold owns I/O.
- Never clobber user files: `opencode.json`, `AGENTS.md`, `armada/REQUIREMENTS.md` written only if absent. `armada/armada.yaml` and `.opencode/` artifacts are armada-owned, always (re)written.
- Prompt templates use `{placeholder}` syntax; a test asserts no dangling placeholders.
- Model IDs are `provider/model`, never bare names.
- Agent prompts ship terse output contracts.
- Tests: `node --test 'tests/*.test.js'` must stay green; fast/deterministic, no network calls.
- Internal orchestrator name must stay `orchestrator` (routing/default_agent depend on it).
- No `displayName` in native opencode — use `color` for TUI distinction (verified).
- Native frontmatter supports: `name`, `model`, `variant`, `description`, `mode`, `hidden`, `color`, `steps`, `options`, `permission`, `disable`, `temperature`, `top_p`.
- Default branch for CI/docs is `master`.

---

### Task 1: Self-contained orchestrator prompt template

**Files:**
- Create: `agents/orchestrator/prompt.template.md`
- Delete: `agents/orchestrator/append.template.md`
- Modify: `src/scaffold.js:50-59` (`PROMPT_SOURCE`)
- Test: `tests/scaffold.test.js:211-234`

**Interfaces:**
- Consumes: the existing placeholder set filled by `fillPrompt` (`{project_name}`, `{requirements_file}`, `{stack_summary}`, `{instructions}`, `{browser_tool}`, etc.)
- Produces: `PROMPT_SOURCE.orchestrator = "agents/orchestrator/prompt.template.md"`; a full standalone prompt that must contain `{requirements_file}` and dependency-driven phase wording.

- [ ] **Step 1: Update the failing tests first**

In `tests/scaffold.test.js`, replace the three "orchestrator append prompt" tests (lines 211-234) with a single test asserting the full prompt's self-containedness:

```js
test("orchestrator full prompt is self-contained and dependency-driven", () => {
  const manifest = makeManifest(".")
  manifest.project.requirementsFile = "REQUIREMENTS-admin.md"
  const filled = fillPrompt(join(__dirname, "..", PROMPT_SOURCE["orchestrator"]), manifest, manifest.project.stack)
  assert.match(filled, /REQUIREMENTS-admin\.md is the contract/)
  assert.match(filled, /co-write|Co-write/)
  assert.match(filled, /Start every ready phase/)
  assert.ok(!/append to your existing|you keep everything/i.test(filled), "must not reference a base prompt")
  assert.ok(!/\{[a-z_]+\}/.test(filled), "no dangling placeholders")
})
```

Also update the instruction-files test (lines 227-234) — it already uses `PROMPT_SOURCE["orchestrator"]`, which now resolves to the new file; keep it, but change its assertion to still match `AGENTS\.md`/`CLAUDE\.md` (should pass unchanged once the new template includes `{instructions}`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test 'tests/scaffold.test.js'`
Expected: FAIL — `PROMPT_SOURCE["orchestrator"]` still points at `append.template.md`, and the new assertion fails because the append prompt references "append to your existing".

- [ ] **Step 3: Create the full prompt template**

Create `agents/orchestrator/prompt.template.md`:

````markdown
# Armada delivery lead — {project_name}

You are the armada delivery lead for {project_name}. You coordinate the team and gate the work;
you never write or edit code yourself. {requirements_file} is the contract: you are done only
when every one of its final success criteria is demonstrably true.

Stack: {stack_summary}

{instructions}

## Orchestration model

You run the project in gated phases from {requirements_file}. Build a dependency graph from the
phases: a phase is ready when every phase it depends on has passed. Start every ready phase —
dispatch its specialists as parallel background subagents (backend-dev and frontend-dev per
phase, the API contract between them fixed first). When background subagent dispatch is
unavailable (one-shot or headless runs), dispatch the specialists inline instead. Never wait on
a phase whose dependencies are already met; nothing blocks a phase except an unmet dependency or
a failed success criterion.

## Contract first — co-write it with the user

The contract lives in {requirements_file}. If its phases or success criteria are blank, do NOT
start building. Co-write the contract with the user:

1. Ask what they want to build — one question at a time (scope, users, auth, data, pages).
   Suggest the best-practice shape for their goal when useful, and let them push back.
2. Draft phases + success criteria. Iterate until there is consensus.
3. Get explicit approval before any implementation. An unapproved contract means no building.
4. If the user wants a different feature later, propose a separate contract file (e.g.
   REQUIREMENTS-<feature>.md) and confirm before switching. Never silently replace an approved
   contract.

## Per-phase execution

1. Write a short plan: the API contract between frontend and backend for this phase, and one
   task spec per developer.
2. Dispatch backend-dev and frontend-dev as parallel subagents (contract fixed first).
3. When they report done, review the evidence: diffs, test output, frontend screenshots. Send
   specific fixes back if they fall short.
4. Have qa write and run the phase's end-to-end tests, run the full suites, capture screenshots.
5. Send the adversary on a short pass over the features this phase added. Triage every finding.
6. Walk the phase's success criteria one by one, each demonstrated by evidence. A passed phase
   unblocks any phase that depends on it.

## Defects

- Dispatch OPEN defects from DEFECTS.md to the right developer, highest severity first.
- Developers report back exactly one of: FIX READY, CANNOT REPRODUCE, or WORKING AS INTENDED,
  with detail. Record it in DEFECTS.md.
- You never set CLOSED. Only qa closes a defect, after retesting.
- You may set REJECTED, with a written reason.

## Adversary triage

For every ADV entry in ADVERSARIAL_REVIEW.md, judge it against {requirements_file}: ACCEPTED
(have qa reproduce and file the DEF entry) or REJECTED - reason. No entry stays PENDING when
the final phase completes.

## Cost discipline

Your model is slow and expensive. Spend it on judgment, not typing. Never write or edit code.
Read diffs, summaries, test output and screenshots — not whole source trees. Do not
micro-manage mid-task. Keep plans and task specs short.

## Output contract

Lead with the decision. One line per item. No narration, no filler. Use path:line references.
````

- [ ] **Step 4: Point PROMPT_SOURCE at the new template**

In `src/scaffold.js`, change `PROMPT_SOURCE.orchestrator` (line 51) from `"agents/orchestrator/append.template.md"` to `"agents/orchestrator/prompt.template.md"`. Delete `agents/orchestrator/append.template.md`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test 'tests/*.test.js'`
Expected: PASS (all other tests still reference `orchestrator_append.md` only as an output path — they will fail in Task 3; if `scaffold.test.js` alone is green, proceed).

- [ ] **Step 6: Commit**

```bash
git add agents/orchestrator/prompt.template.md src/scaffold.js tests/scaffold.test.js
git rm agents/orchestrator/append.template.md
git commit -m "feat(orchestrator): self-contained full prompt, drop omo-slim append model"
```

---

### Task 2: Generator — render native agent files, shrink opencode.json

**Files:**
- Modify: `src/generator.js` (remove `renderSlimJsonc`, add `renderAgentFile`, update `renderOpenCodeJson`, update `renderArmadaCommand`)
- Test: `tests/generator.test.js`

**Interfaces:**
- Consumes: `buildTeam(manifest) → team[]` where each entry has `{role, model, fallback, variant, permissions, orchestratorPrompt, browser, enabled}` (unchanged).
- Produces:
  - `renderAgentFile(agent, promptText) → string` — a full `.opencode/agent/<role>.md` document (YAML frontmatter + `---` + blank line + body).
  - `renderOpenCodeJson(manifest, team) → object` — now `{ $schema, model, permission: { external_directory }, default_agent: "orchestrator" }`, **no `agent` key**.
  - `renderArmadaCommand() → string` — references `.opencode/agent/`.

- [ ] **Step 1: Add failing generator tests**

Add to `tests/generator.test.js` (and update imports: drop `renderSlimJsonc`, add `renderAgentFile`):

```js
test("renderAgentFile emits native frontmatter + body", () => {
  const team = buildTeam(baseManifest)
  const qa = team.find((a) => a.role === "qa")
  const out = renderAgentFile(qa, "You are the qa agent for {project_name}.")
  assert.match(out, /^---\n/)
  assert.match(out, /\nmode: subagent\n/)
  assert.match(out, /model: opencode\/mimo-v2\.5-free\n/)
  assert.match(out, /permission:/)
  assert.match(out, /\n---\n\nYou are the qa agent/)
})

test("renderAgentFile orchestrator is primary with color, no displayName", () => {
  const team = buildTeam(baseManifest)
  const orch = team.find((a) => a.role === "orchestrator")
  const out = renderAgentFile(orch, "You are the orchestrator.")
  assert.match(out, /mode: primary\n/)
  assert.match(out, /color: cyan\n/)
  assert.doesNotMatch(out, /displayName/)
})

test("renderOpenCodeJson has no agent block, sets default_agent", () => {
  const team = buildTeam(baseManifest)
  const cfg = renderOpenCodeJson(baseManifest, team)
  assert.strictEqual(cfg.model, modelFor("orchestrator", "balanced"))
  assert.strictEqual(cfg.permission.external_directory, "deny")
  assert.strictEqual(cfg.default_agent, "orchestrator")
  assert.strictEqual(cfg.agent, undefined, "agent block removed")
})

test("renderOpenCodeJson model follows budget tier", () => {
  const m = structuredClone(baseManifest)
  m.project.budget = "free"
  const cfg = renderOpenCodeJson(m, buildTeam(m))
  assert.strictEqual(cfg.model, modelFor("orchestrator", "free"))
  assert.strictEqual(cfg.default_agent, "orchestrator")
})
```

Also **replace** the two "slim jsonc" tests (lines 137-152) with nothing (deleted) — remove them. Update the import line (line 8) to remove `renderSlimJsonc`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test 'tests/generator.test.js'`
Expected: FAIL — `renderAgentFile` is undefined; `renderOpenCodeJson` still returns `agent` and no `default_agent`.

- [ ] **Step 3: Implement renderAgentFile + shrink opencode.json**

In `src/generator.js`:

- Add import: `import YAML from "yaml"` at the top (after the existing imports).
- Add `renderAgentFile`:

```js
// Render one native opencode agent file: YAML frontmatter + prompt body.
// Native opencode has no `displayName`; the orchestrator keeps its internal
// name and a color for TUI distinction. Mode/model/permission live in the
// frontmatter so the roster works without any plugin.
export function renderAgentFile(agent, promptText) {
  const frontmatter = {
    description: CATALOG[agent.role].label,
    mode: agent.role === "orchestrator" ? "primary" : "subagent",
    ...(agent.model ? { model: agent.model } : {}),
    ...(agent.variant ? { variant: agent.variant } : {}),
    ...(agent.role === "orchestrator" ? { color: "cyan" } : {}),
    ...(Object.keys(agent.permissions || {}).length ? { permission: agent.permissions } : {}),
  }
  const yaml = YAML.stringify(frontmatter).trim()
  return `---\n${yaml}\n---\n\n${promptText}`
}
```

- **Remove** `renderSlimJsonc` entirely (and its export).
- Update `renderOpenCodeJson` (lines 173-198): drop the `agents` loop and the `agent` spread; return:

```js
export function renderOpenCodeJson(manifest, team) {
  return {
    $schema: "https://opencode.ai/config.json",
    model: modelFor("orchestrator", manifest.project?.budget ?? "balanced"),
    permission: {
      external_directory: "deny",
    },
    default_agent: "orchestrator",
  }
}
```

- Update `renderArmadaCommand` body: change "from .opencode/oh-my-opencode-slim.jsonc" to "from .opencode/agent/".

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test 'tests/generator.test.js'`
Expected: PASS (after you also remove the two slim-jsonc tests in Step 1 and the now-obsolete "renderOpenCodeJson includes agent block" and "omits disabled team entries" tests — delete them too, since the agent block no longer exists).

- [ ] **Step 5: Commit**

```bash
git add src/generator.js tests/generator.test.js
git commit -m "feat(generator): emit native .opencode/agent files, shrink opencode.json"
```

---

### Task 3: Scaffold — write agent files, prune stale omo artifacts, update uninstall

**Files:**
- Modify: `src/scaffold.js` (steps 1-2 in `scaffold`, `uninstall`)
- Test: `tests/scaffold.test.js`, `tests/cli.test.js:69-76,187-235`, `tests/new-command.test.js:73`

**Interfaces:**
- Consumes: `renderAgentFile(agent, promptText)` from Task 2; `buildTeam(manifest)`.
- Produces: `scaffold()` writes `.opencode/agent/<role>.md` for each enabled role; `uninstall()` removes exactly those 8 role files (by name) + stale omo-slim artifacts; returns lists of written/removed relative paths.

- [ ] **Step 1: Update failing scaffold tests**

In `tests/scaffold.test.js`:

- `scaffold writes all expected files` (line 65): replace the `expected` array with:

```js
  const expected = [
    "armada/armada.yaml",
    "armada/REQUIREMENTS.md",
    ".opencode/commands/armada.md",
    ...ROLES.map((r) => `.opencode/agent/${r}.md`),
  ]
  for (const f of expected) {
    assert.ok(files.includes(f), `missing in list: ${f}`)
    assert.ok(existsSync(join(dir, f)), `missing on disk: ${f}`)
  }
```

  Remove the jsonc-parse block (lines 87-91). Add a frontmatter assertion:

```js
  const orch = readFileSync(join(dir, ".opencode/agent/orchestrator.md"), "utf8")
  assert.match(orch, /^---\n/m)
  assert.match(orch, /mode: primary/)
```

- `scaffold dryRun writes nothing` (line 131): replace `.opencode/oh-my-opencode-slim.jsonc` with `.opencode/agent/orchestrator.md` in the `files.includes` assertion.
- `uninstall keeps user files under .opencode/ and warns` (line 169): the armada role files now live in `.opencode/agent/`. Update so it writes a user file `.opencode/agent/custom.md`, runs uninstall, and asserts `custom.md` survives while armada role files are gone:

```js
  assert.ok(!existsSync(join(dir, ".opencode/agent/backend-dev.md")), "armada role file removed")
  assert.ok(!existsSync(join(dir, ".opencode/oh-my-opencode-slim")), "stale omo dir pruned")
  assert.ok(existsSync(custom), "user file kept")
  assert.ok(existsSync(join(dir, ".opencode")), ".opencode dir kept")
  assert.ok(!removed.includes(".opencode"))
  assert.ok(warns.some((w) => /non-armada/.test(w)), "warning emitted")
```

- Add a stale-prune test:

```js
test("scaffold prunes stale omo-slim artifacts on re-scaffold", () => {
  const dir = mkdtempSync(join(tmpdir(), "armada-prune-"))
  mkdirSync(join(dir, ".opencode"), { recursive: true })
  writeFileSync(join(dir, ".opencode/oh-my-opencode-slim.jsonc"), "{}")
  const manifest = makeManifest(dir)
  scaffold(manifest, manifest.project.stack)
  assert.ok(!existsSync(join(dir, ".opencode/oh-my-opencode-slim.jsonc")))
  assert.ok(existsSync(join(dir, ".opencode/agent/orchestrator.md")))
  rmSync(dir, { recursive: true, force: true })
})
```

- [ ] **Step 2: Update CLI/new-command tests**

In `tests/cli.test.js`:
- `init --from-armada scaffolds full team` (line 73): replace `".opencode/oh-my-opencode-slim.jsonc"` with `".opencode/agent/orchestrator.md"`.
- `init --headless` (line 229): replace the jsonc read with the agent frontmatter read:

```js
  const orch = readFileSync(join(dir, ".opencode/agent/orchestrator.md"), "utf8")
  const fm = orch.slice(orch.indexOf("---") + 3, orch.indexOf("---\n", 3))
  const cfg = { permission: parseFrontmatter(fm) }
  assert.strictEqual(cfg.permission.bash["*"], "deny")
  assert.strictEqual(cfg.permission.bash["git status*"], "allow")
  assert.strictEqual(cfg.permission.bash["git diff*"], "allow")
  assert.strictEqual(cfg.permission.bash["git log*"], "allow")
```

  Add a small `parseFrontmatter` helper to `tests/helpers.js`:

```js
import YAML from "yaml"
export function parseFrontmatter(frontmatterYaml) {
  return YAML.parse(frontmatterYaml)
}
```

- `uninstall CLI keeps user .opencode files and warns` (line 212): change assertion at line 217 from `.opencode/oh-my-opencode-slim.jsonc` to `.opencode/agent/backend-dev.md` (must be removed), keep the `custom.md` assertion.

In `tests/new-command.test.js` line 73: replace `.opencode/oh-my-opencode-slim.jsonc` with `.opencode/agent/orchestrator.md`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test 'tests/scaffold.test.js' 'tests/cli.test.js' 'tests/new-command.test.js'`
Expected: FAIL — old artifacts not written; new assertions fail.

- [ ] **Step 4: Implement scaffold + uninstall changes**

In `src/scaffold.js`:

Replace steps 1 and 2 (lines 92-105) with:

```js
  // 1. Native agent files: one .opencode/agent/<role>.md per enabled role.
  //    Frontmatter carries mode/model/permission; body is the filled prompt.
  for (const a of team) {
    if (!a.enabled) continue
    const src = join(ROOT, PROMPT_SOURCE[a.role])
    const content = renderAgentFile(a, fillPrompt(src, manifest, stack))
    write(`.opencode/agent/${a.role}.md`, content)
  }

  // 1b. Prune stale omo-slim artifacts from the old layout (armada-owned).
  const staleJsonc = out(".opencode/oh-my-opencode-slim.jsonc")
  if (!opts.dryRun && existsSync(staleJsonc)) rmSync(staleJsonc, { force: true })
  const staleDir = join(target, ".opencode/oh-my-opencode-slim")
  if (!opts.dryRun && existsSync(staleDir)) rmSync(staleDir, { recursive: true, force: true })
```

Update the import on line 17 to add `renderAgentFile`. Also record the pruned paths in the returned `files` list (so `init` output shows them) — optional; skip for simplicity, but `rmSync` must only touch armada-owned paths (both are).

Update `uninstall` (lines 194-221): replace the prompt-dir removal block with role-file removal:

```js
  // Remove armada's native agent files by exact role name; keep any user agent files.
  const agentDir = join(target, ".opencode/agent")
  if (existsSync(agentDir)) {
    for (const role of ROLES) {
      removeFile(`.opencode/agent/${role}.md`)
    }
  }
  removeEmptyDir(".opencode/agent")
  // Prune stale omo-slim artifacts (old layout) if present.
  removeFile(".opencode/oh-my-opencode-slim.jsonc")
  const stalePromptDir = join(target, ".opencode/oh-my-opencode-slim")
  if (existsSync(stalePromptDir)) {
    for (const f of readdirSync(stalePromptDir)) {
      if (f.endsWith(".md")) removeFile(`.opencode/oh-my-opencode-slim/${f}`)
    }
    removeEmptyDir(".opencode/oh-my-opencode-slim")
  }
```

Import `ROLES` from `./model-catalog.js` at the top of `src/scaffold.js`.

- [ ] **Step 5: Run full suite**

Run: `node --test 'tests/*.test.js'`
Expected: PASS — after updating every stale artifact reference. Grep to confirm none remain: `rg "oh-my-opencode-slim" tests/ src/` should return no hits except `src/doctor.js` (Task 4) and doc files.

- [ ] **Step 6: Commit**

```bash
git add src/scaffold.js tests/scaffold.test.js tests/cli.test.js tests/new-command.test.js tests/helpers.js
git commit -m "feat(scaffold): native agent emission, prune stale omo-slim layout"
```

---

### Task 4: Doctor — native environment checks

**Files:**
- Modify: `src/doctor.js`
- Test: `tests/doctor.test.js`

**Interfaces:**
- Consumes: `runDoctor(opts) → checks[]` (keep signature; `opts.env` used by tests).
- Produces: checks with names `opencode CLI`, `providers auth`, `background dispatch`, `node`. No plugin/config reads.

- [ ] **Step 1: Rewrite failing doctor tests**

Replace `tests/doctor.test.js` with:

```js
import { test } from "node:test"
import assert from "node:assert"
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
  const checks = await runDoctor({
    env: envWith(binDir, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" }),
  })
  assert.deepStrictEqual(checks.map((c) => c.status), ["pass", "pass", "pass", "pass"])
})

test("background dispatch reports the native flag when enabled", async () => {
  const binDir = makeBin({ opencode: SH })
  const checks = await runDoctor({ env: envWith(binDir, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: "true" }) })
  const bg = checks.find((c) => c.name === "background dispatch")
  assert.strictEqual(bg.status, "pass")
  assert.match(bg.detail, /OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true/)
})

test("background dispatch stays pass but notes disabled when env unset", async () => {
  const binDir = makeBin({ opencode: SH })
  const checks = await runDoctor({ env: envWith(binDir) })
  const bg = checks.find((c) => c.name === "background dispatch")
  assert.strictEqual(bg.status, "pass")
  assert.match(bg.detail, /disabled/)
})

test("fails when opencode missing", async () => {
  const empty = mkdtempSync(join(tmpdir(), "armada-nobin-"))
  const checks = await runDoctor({ env: { ...process.env, PATH: empty } })
  assert.deepStrictEqual(
    checks.map((c) => ({ name: c.name, status: c.status })),
    [
      { name: "opencode CLI", status: "fail" },
      { name: "providers auth", status: "fail" },
      { name: "background dispatch", status: "pass" },
      { name: "node", status: "pass" },
    ]
  )
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test 'tests/doctor.test.js'`
Expected: FAIL — old doctor checks reference the plugin; counts differ.

- [ ] **Step 3: Rewrite runDoctor**

Replace `src/doctor.js` with:

```js
import { execFile } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"

function run(bin, args, env) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 15000, env }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: `${stdout ?? ""}${stderr ?? ""}`.trim() }))
  })
}

function firstLine(out, fallback) {
  const line = out.split("\n").map((l) => l.trim()).find((l) => l.length > 0)
  return line ?? fallback
}

export async function runDoctor(opts = {}) {
  const env = opts.env ?? process.env
  const checks = []

  const v = await run("opencode", ["--version"], env)
  checks.push({
    name: "opencode CLI",
    status: v.ok ? "pass" : "fail",
    detail: v.ok ? v.out || "exit 0" : firstLine(v.out, "command failed"),
  })

  const auth = await run("opencode", ["providers", "list"], env)
  checks.push({
    name: "providers auth",
    status: auth.ok ? "pass" : "fail",
    detail: firstLine(auth.out, auth.ok ? "exit 0" : "command failed"),
  })

  const bg = env.OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS === "true"
  checks.push({
    name: "background dispatch",
    status: "pass",
    detail: bg
      ? "OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true (native parallel background subagents)"
      : "OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS not set — parallel background dispatch disabled (inline fallback)",
  })

  checks.push({ name: "node", status: "pass", detail: process.version })
  return checks
}
```

Drop the now-unused `readFileSync`/`existsSync`/`homedir`/`join` imports (keep what's used).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test 'tests/doctor.test.js'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/doctor.js tests/doctor.test.js
git commit -m "feat(doctor): native checks, drop omo-slim plugin dependency"
```

---

### Task 5: CLI — main() returns exit codes for every command

**Files:**
- Modify: `src/cli.js`
- Test: `tests/cli.test.js` (add a case)

**Interfaces:**
- Consumes: existing command handlers.
- Produces: `main(argv) → number` — 0 on success for `init`/`models`/`doctor`/`uninstall`/`ping`/`new`, 1 on handled failure (via `process.exitCode` when run as a script; programmatic callers get the returned int).

- [ ] **Step 1: Add failing test**

Add to `tests/cli.test.js`:

```js
test("main returns 0 for successful init", async () => {
  const dir = makeTempRepo({ "armada/armada.yaml": manifestYaml() })
  const prev = process.exitCode
  process.exitCode = 0
  const code = await main(["init", "--from-armada", join(dir, "armada/armada.yaml")])
  assert.strictEqual(code, 0)
  process.exitCode = prev
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test 'tests/cli.test.js'`
Expected: FAIL — `main(["init", ...])` returns `undefined`.

- [ ] **Step 3: Make every handler return an int**

In `src/cli.js`:

- `init` (line 171): every `return` on success becomes `return 0`; every failure branch that sets `process.exitCode = 1` also `return 1`.
- `models` (line 277): success paths `return 0`; failure `return 1`.
- `doctor` (line 304): after printing, `return anyFail ? 1 : 0` and remove the `process.exitCode` mutation.
- `uninstallCmd` (line 315): success `return 0`; failure `return 1`.
- `ping` (line 108): `return 0`.
- `new` (line 111): `return runNew({...})` — ensure `runNew` returns 0/1 (it currently returns undefined; wrap: `const code = await runNew({...}); return code ?? 0`).
- `main` default case already `return 1`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test 'tests/*.test.js'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli.js tests/cli.test.js
git commit -m "fix(cli): main() returns exit-code int for every command"
```

---

### Task 6: Docs — drop omo-slim from README, SPEC, ARCHITECTURE, AGENTS.md

**Files:**
- Modify: `README.md`, `SPEC.md`, `ARCHITECTURE.md`, `AGENTS.md`, `src/cli.js` (HELP text)

**Interfaces:**
- None (docs).

- [ ] **Step 1: README prerequisites**

Remove the oh-my-opencode-slim install step from Prerequisites (currently `npx oh-my-opencode-slim@latest install --preset=opencode-go`). Replace with:

```markdown
- [opencode](https://opencode.ai) installed
- Provider auth: `opencode auth login` (OpenCode Go for free models, OpenRouter for fallbacks)
- For parallel background dispatch, launch opencode with:
  ```bash
  OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true opencode
  ```
```

Also update the "omo-slim runs the crew at runtime" phrasing in "How you use it" to "opencode runs the crew natively (background subagents)".

- [ ] **Step 2: SPEC.md**

- §1 "What it is": drop `oh-my-opencode-slim` from the description; §1.2 Dependencies table: remove the omo-slim row (keep opencode; OpenCode Go optional).
- §3 "Why it is not a plugin": rewrite the omo-slim role bullet — replace with "armada is a generator; opencode is the runtime. Armada emits native opencode agents and commands; no plugin is required."
- §7 Generated artifacts table: replace `.opencode/oh-my-opencode-slim.jsonc` and `.opencode/oh-my-opencode-slim/<role>.md` rows with `.opencode/agent/<role>.md` (native, always re-written).

- [ ] **Step 3: ARCHITECTURE.md**

- Module map: `generator.js` bullet — replace "renderers (team, slim jsonc, opencode.json, AGENTS.md...)" with "(team, native agent files, opencode.json, AGENTS.md, REQUIREMENTS.md, armada.yaml)".
- Data flow: change `renderSlimJsonc(manifest, team)   → .opencode/oh-my-opencode-slim.jsonc` to `renderAgentFile(agent, prompt) → .opencode/agent/<role>.md`.

- [ ] **Step 4: AGENTS.md (project rules)**

Remove the "Environment notes" section (patched omo-slim, `/tmp/armada-tui` sim, 158 tests). Replace with a one-line note: the team is native opencode agents (`.opencode/agent/*.md`); no plugin is required.

- [ ] **Step 5: HELP text**

In `src/cli.js` line 30, change `Reproducible AI-engineer multi-agent teams for opencode, on oh-my-opencode-slim.` to `Evidence-gated AI-engineer teams for opencode, natively (no plugin).`

- [ ] **Step 6: Run tests + smoke**

Run: `node --test 'tests/*.test.js'` then `node src/cli.js help`.
Expected: PASS; help prints the new tagline.

- [ ] **Step 7: Commit**

```bash
git add README.md SPEC.md ARCHITECTURE.md AGENTS.md src/cli.js
git commit -m "docs: native mode — remove omo-slim from README, SPEC, ARCHITECTURE, AGENTS"
```

---

## Self-review notes (verification against spec)

- §4 artifact layout → Tasks 2 + 3.
- §5 orchestrator prompt → Task 1.
- §6 parallel dispatch → Task 1 (prompt) + Task 4 (doctor env guidance) + README (Task 6).
- §7 hardening → manifest.js already rejects traversal/empty-model/dup-roles/loose booleans (existing tests cover); `buildTeam` already honors overrides (existing test); `renderManifestYaml` already quotes scalars (existing test). Remaining gap is `main()` exit codes → Task 5. YAML/JSONC injection is mooted by the `.md` layout (Task 2 removes the jsonc emitter).
- §8 doctor/uninstall//armada → Tasks 4, 3, 2.
- §9 tests → each task's tests.
- §10 docs → Task 6.
