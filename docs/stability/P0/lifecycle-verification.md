# Lifecycle Verification

## Independent re-run (fresh temp dir)

Temp dir: `/tmp/armada-lifecycle-test`
Source: `node src/cli.js` (local build, not global `armada`)

### Step 1: init

Command: `node <src>/cli.js init --yes --budget free`

Output:
```
Scaffolded opencode-armada team:
  + .opencode/agent/commodore.md
  + .opencode/agent/galleon.md
  + .opencode/agent/clipper.md
  + .opencode/agent/corvette.md
  + .opencode/agent/xebec.md
  + .opencode/agent/frigate.md
  + .opencode/agent/caravel.md
  + .opencode/agent/bark.md
  + .opencode/skills/armada-contract/SKILL.md
  + .opencode/skills/armada-gate/SKILL.md
  + .opencode/skills/armada-dispatch/SKILL.md
  + .opencode/skills/armada-pr/SKILL.md
  + .opencode/skills/armada-resume/SKILL.md
  + .opencode/skills/armada-ledger/SKILL.md
  + .opencode/skills/armada-context-budget/SKILL.md
  + .opencode/skills/armada-tdd/SKILL.md
  + .opencode/skills/armada-sdd/SKILL.md
  + opencode.json
  + AGENTS.md
  + armada/REQUIREMENTS.md
  + armada/armada.yaml
  + armada/ledgers/_template/SECURITY_FINDINGS.md
  + .opencode/commands/armada.md
  + .opencode/commands/armada-scout.md
  + .opencode/commands/armada-resume.md
  + .opencode/commands/armada-voyage.md
  + .opencode/plugins/armada-fleet.js
  + .gitignore
Project: armada-lifecycle-test
Team: 8 agents
Budget: free
Cost:   zero usage cost
```

### Step 2: doctor

Command: `node <src>/cli.js doctor`
Exit: 0

Checks:
- opencode CLI: pass (1.18.13)
- providers auth: pass (credentials at ~/.local/share/opencode/auth.json)
- openrouter auth: pass (credential found)
- background dispatch: pass (OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS not set)
- node: pass (v23.9.0)
- global armada binary: pass (opencode-armada v0.9.2)
- team roster: pass (8 agents, all listed)
- fleet tracker plugin: pass (.opencode/plugins/armada-fleet.js present)
- model-drift: pass (all role frontmatters match armada.yaml)

### Step 3: status

Command: `node <src>/cli.js status`
Exit: 1
Output: `no active feature or feature index`

Correct for fresh init with no features.

### Step 4: uninstall

Command: `node <src>/cli.js uninstall`
Exit: 0

Removed: armada.yaml, REQUIREMENTS.md, ledgers, .opencode/agents, .opencode/skills, .opencode/commands, .opencode/plugins, .gitignore.
Preserved: AGENTS.md, opencode.json (user-owned files).

Post-uninstall state: only AGENTS.md and opencode.json remain — correct.

## Drift check

Independently confirmed outputs match galleon's report. No drift found.

- File count (28 scaffolded) matches.
- Agent roster (8 roles, free-tier models) matches.
- Doctor checks (all pass) match.
- Uninstall behavior (armada-owned removed, user-owned preserved) matches.
- opencode.json structure (model, permission, default_agent, provider.openrouter) matches.

## Evidence check

| Command | Exit | Expected | Result |
|---------|------|----------|--------|
| init --yes --budget free | 0 | scaffold 28 files | PASS |
| doctor | 0 | all checks pass | PASS |
| status | 1 | no active feature | PASS |
| uninstall | 0 | remove armada-owned | PASS |
