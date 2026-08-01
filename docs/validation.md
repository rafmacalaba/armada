# Validation Plan

Goal: prove opencode-armada works end-to-end in a real repo, then document the result.

## Target repo

`~/WBG/data-ai-chatbot` — Python FastAPI backend + React/Next.js frontend.

## Steps

1. **Stack detection**
   ```bash
   cd ~/WBG/data-ai-chatbot
   node ~/WBG/opencode-armada/src/cli.js init --from-armada <manifest>
   ```
   First confirm `detectStack` returns `python-fastapi` + `nextjs`. The repo has
   `backend/`, `frontend/`, `docker-compose.yml`, `requirements.txt` — good candidates.

2. **Scaffold** (dry-run first once `--dry-run` exists, else real)
   - Confirm `opencode.json`, `AGENTS.md`, `REQUIREMENTS.md` are NOT overwritten (they don't
     exist yet, so they'll be created).
   - Confirm `.opencode/oh-my-opencode-slim.jsonc` + prompt files are written.

3. **Load in opencode**
   - `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true opencode`
   - `/armada` → team status
   - `ping all agents` → all 8 roles respond

4. **Real build smoke test**
   - Give the orchestrator a bounded task (e.g. "add one endpoint + one page"), watch it
     dispatch background specialists, reconcile, verify.

5. **Record findings**
   - Model ID availability on the user's actual providers
   - Prompt quality against the repo conventions
   - Any omo-slim schema drift
   - Update TODO.md and close the "Next" section when done.

## Result

Append the outcome (pass/fail + notes) to this file when the validation runs.
