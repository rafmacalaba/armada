---
name: armada-pr
description: PR-first finish for a feature lane. Use before reporting a feature done. Triggers on: PR, finish feature, gh pr create, merge, lane complete.
---

# Armada: PR-First Finish

The final step before reporting a feature lane done is creating a pull request. Never merge locally, never push master directly. The PR URL is the proof of delivery.

## Rules

1. Create the PR from the lane branch: `gh pr create --base master`. Include a summary of changes and evidence links.
2. Never `git merge` locally. Never `git push origin master`. The PR is the only path to integration.
3. Write the PR URL into `armada/state/active.json` field `prUrl`. Example: `"prUrl": "https://github.com/owner/repo/pull/42"`.
4. If a PR is genuinely blocked (no remote, no permissions), state "PR blocked: <reason>" and report it to the commodore. Do not claim done without a PR URL or a stated blocker.
5. Do not close or merge the PR yourself. The human partner reviews and merges.

Example: `gh pr create --base master --title "feat: skills expansion wave 2.5" --body "Phase 1-3 evidence attached."`
