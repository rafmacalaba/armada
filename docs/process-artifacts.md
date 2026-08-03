# Process artifacts

These are fleet voyage records — development process, not product. They track the
active voyage during development but are not part of the public repo.

- **DEFECTS.md** — Fleet voyage defect ledger
- **ADVERSARIAL_REVIEW.md** — Fleet voyage adversarial review ledger
- **AUDIT.md** — Fleet voyage audit trail

These files are gitignored (`# armada:process` block in `.gitignore`) and should be
untracked from the public repo index.

To untrack them from a clone that still has them indexed, run:

    ./scripts/untrack-process-artifacts.sh

The script uses `git rm --cached` — files stay on disk, removed only from the index.
It is idempotent and safe to run at any time.
