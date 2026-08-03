#!/usr/bin/env bash
# untrack-process-artifacts.sh
#
# Removes fleet voyage process artifacts from the git index via `git rm --cached`.
# Does NOT delete files from disk. Idempotent: skips already-untracked files.
#
# Run from repo root on master post-merge to clean the public repo of process
# artifacts so contributors see only product code (src/, tests/, agents/, docs/,
# presets/, starter/, etc.).
#
# Files untracked:
#   DEFECTS.md            — fleet voyage defect ledger
#   ADVERSARIAL_REVIEW.md — fleet voyage adversarial review ledger
#   AUDIT.md              — fleet voyage audit trail

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO_ROOT" ]; then
  echo "ERROR: not in a git repository" >&2
  exit 2
fi
cd "$REPO_ROOT"

FILES=(
  "DEFECTS.md"
  "ADVERSARIAL_REVIEW.md"
  "AUDIT.md"
)

FAILED=0

for f in "${FILES[@]}"; do
  if git ls-files --error-unmatch "$f" > /dev/null 2>&1; then
    echo "Untracking: $f"
    git rm --cached "$f" || { echo "ERROR: failed to untrack $f" >&2; FAILED=1; }
  else
    echo "Already untracked (skip): $f"
  fi
done

if [ $FAILED -ne 0 ]; then
  echo "ERROR: one or more files failed to untrack" >&2
  exit 1
fi

echo "Done. Process artifacts untracked from git index."
