# Manual Resume Walkthrough for `~/WBG/data-ai-chatbot`

This walkthrough proves the restart-proof resume path works in the live target repo. The user runs these commands interactively.

## Pre-flight

```bash
cd ~/WBG/data-ai-chatbot

# Ensure global armada binary is installed
npm install -g opencode-armada

# If the above fails (package not yet on npm), install locally:
#   npm link    (from the armada source tree at <armada-checkout>/)
#   or copy src/cli.js to a location on PATH and wrap it:
#     cp <armada-checkout>/src/cli.js /opt/homebrew/bin/armada
#     chmod +x /opt/homebrew/bin/armada
# See feat/resume-reachable commit 81bda38 for the canonical pattern.

# Verify it is on PATH
command -v armada
# Expected: /opt/homebrew/bin/armada or similar absolute path

# If the repo is not yet armed (omo-slim era), re-scaffold first:
#   mv opencode.json opencode.json.omo-backup
#   mv AGENTS.md AGENTS.md.omo-backup
#   rm -rf .opencode/
#   armada init --from-armada armada/armada.yaml --yolo
```

## Step 1: Create a scratch feature

```bash
armada feature new scratch-resume-walkthrough
```
Expected:
```
feature "scratch-resume-walkthrough" created
  contract: armada/contracts/scratch-resume-walkthrough.md
  entry:    armada/state/features/scratch-resume-walkthrough.json
  index:    armada/state/features/index.json
  active:   armada/state/active.json
```

Check: `armada/state/active.json` exists with `"feature": "scratch-resume-walkthrough"` and phase-1 = "pending".

## Step 2: Verify state before session starts

```bash
cat armada/state/active.json | python3 -m json.tool | head -20
```
Expected: phase-1 status is "pending". Copy the structure from `armada/REQUIREMENTS.md` in this sandbox — `phaseGraph.phases[].id|title|status|criteria[].id|text|evidence` is the schema. A minimum one-phase contract is enough.

```bash
armada feature status
```
Expected: `active feature: scratch-resume-walkthrough`

## Step 3: Start session and begin the phase

```bash
opencode
```
In the opencode session, tell the orchestrator: "begin phase 1 of scratch-resume-walkthrough"

The orchestrator reads `armada/state/active.json`, finds phase-1 pending, updates it to `in_progress`, and starts working.

**Mid-phase**: kill the opencode session.
- In TUI: press Ctrl+C twice, or
- From another terminal: `pkill -9 -f opencode`

## Step 4: Run reconcile

```bash
armada reconcile
```
Expected output (exact text will vary, pattern is important):
```
resume: feature scratch-resume-walkthrough, phase phase-1 (in_progress), evidence 0 in, drift 0, next "All tests pass"
```

Check:
- Resume line names the feature
- Resume line names the current phase (phase-1) and its status (in_progress)
- If the orchestrator wrote evidence before being killed, evidence count > 0
- Drift count = 0 (no evidence deleted mid-session)
- Next action from the contract

If `armada` binary is not on PATH, the fallback `node src/cli.js reconcile` won't work in a generated repo (no src/). Install the global binary.

## Step 5: Resume the session

```bash
opencode
```
In the opencode session, tell the orchestrator: "resume" or run `/armada-resume`.

The orchestrator reads `armada/state/active.json`, sees phase-1 is `in_progress`, and picks up exactly where it left off.

**Verify no state loss**:

```bash
# Before resume
cat armada/state/active.json | python3 -m json.tool > /tmp/before-resume.json

# After resume (once orchestrator resumes)
cat armada/state/active.json | python3 -m json.tool > /tmp/after-resume.json

diff /tmp/before-resume.json /tmp/after-resume.json
```
Expected: only `updatedAt` and any progress fields changed. No lost evidence, no lost phase state.

## Step 6: Cleanup

```bash
# Remove the scratch feature from active state
rm armada/state/active.json

# Remove feature index entry (edit armada/state/features/index.json to remove scratch-resume-walkthrough)
# Or re-scaffold to reset:
armada init --from-armada armada/armada.yaml --yolo
```

## What this proves

1. `armada reconcile` reads `armada/state/active.json` and produces a resume line naming the feature, phase, evidence count, and next action.
2. After a hard kill, no state is lost — the orchestrator resumes exactly where it left off.
3. The `/armada-resume` command works in a generated repo (no armada source) via the global binary.
4. Drift detection works: delete an evidence file, re-run reconcile, exit code = 2 with drift list.
