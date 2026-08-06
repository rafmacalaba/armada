# armada/ledgers/armada-new-templates/SECURITY_FINDINGS.md — security findings

All security findings live in `armada/ledgers/armada-new-templates/SECURITY_FINDINGS.md`, one entry
per finding, newest first. Writer: **security** (create findings). Statuses: OPEN, ACCEPTED,
REJECTED, MITIGATED. The orchestrator sets Disposition. Nobody else edits.

Format, exactly:

    ## SEC-###: Title

    - Status: OPEN
    - Severity: HIGH | MEDIUM | LOW
    - Found by: security
    - Phase: N

    What I found: ...
    Expected: ...
    Actual: ...
    Screenshot: armada/screenshots/armada-new-templates/sec-###.png (optional)

    History:
    - security: opened

Statuses and who may set them:

| Status | Meaning | Set by |
|--------|---------|--------|
| OPEN | New finding, pending review | security |
| ACCEPTED | Finding confirmed, fix planned | orchestrator |
| REJECTED | Not a vulnerability / not in scope | orchestrator |
| MITIGATED | Fix applied and verified | orchestrator |

Every status change appends a History line.

## SEC-001: Unescaped cookiecutter variable substitution allows JSON/script injection into rendered project files

- Status: ACCEPTED  (-> DEF-007)  # real injection in cookiecutter substitution; pre-existing but in-scope; fix in this voyage  # ACCEPTED -> DEF-007 — real injection in cookiecutter substitution; pre-existing but in-scope; fix in this voyage
- Severity: MEDIUM
- Found by: security
- Phase: 3

What I found: `renderCookiecutterTemplate` (src/new-command.js:102) substitutes `{{ cookiecutter.NAME }}` values with zero escaping: `content.replace(VARIABLE_RE, (m, key) => vars[key] !== undefined ? vars[key] : m)`. Variable values come from `--config` JSON, `COOKIECUTTER_*` env vars, or the interactive prompt (src/new-command.js:134-191) and are written verbatim into every rendered file. Templates put these values in JSON contexts (web-app/api-service/cli-tool `package.json` name/description/author, `bin` field), HTML (`index.html` title), JSX (App.tsx), TOML (pyproject.toml), and LaTeX (paper.tex).

Expected: variable values are inert strings; generated files remain well-formed.

Actual: demonstrated with a malicious `--config` (description value `", "scripts": {"preinstall": "echo PWNED >> /tmp/secprobe/pwned.txt"}, "private": "", "dummy": "`):

- Rendered `package.json` parses as valid JSON with an attacker-injected `"scripts": {"preinstall": "echo PWNED ..."}` — verified via `JSON.parse`. `npm install` in the generated project runs `preinstall` lifecycle scripts, i.e. arbitrary command execution on the victim machine when the injected file is used.
- Description `<script>alert(document.cookie)</script>` lands raw in rendered README.md (verified) and would land in `index.html` title / App.tsx JSX (stored XSS when the project is served).
- Same sink breaks pyproject.toml and paper.tex with a stray `"`.

Pre-existing on master (carried into the refactored runNew in this voyage). Attack chain requires attacker-influenced var values (shared/untrusted `--config` file, inherited env, or social engineering of the prompt).

Screenshot: (not applicable)

History:
- security: opened

## SEC-002: Template renderer follows symlinks — malicious external template can read arbitrary local files into the generated project

- Status: ACCEPTED  (-> DEF-008)  # template symlink follow leaks arbitrary local files; reject symlinks in renderer  # ACCEPTED -> DEF-008 — template symlink follow leaks arbitrary local files; reject symlinks in renderer
- Severity: MEDIUM
- Found by: security
- Phase: 3

What I found: `renderCookiecutterTemplate` (src/new-command.js:83-105) and `discoverVariables` (src/new-command.js:46-70) use `statSync`/`readFileSync`/`readdirSync`, all of which follow symlinks; there is no `lstat`/`realpath` check. A template dir (external via `--template <url>` or local) containing a symlink to any local file gets that file's content copied into the generated project.

Expected: template symlinks are not followed, or are rejected; rendering stays inside the template tree.

Actual: crafted template dir with `leaked.txt -> /tmp/secprobe/secret.txt` (content `SUPER-SECRET-KEY-MATERIAL-123`):

- `armada new app --template /tmp/secprobe/tmpl2 --yes` (real CLI, cwd /tmp/secprobe/cli2) produced `app/leaked.txt` containing `SUPER-SECRET-KEY-MATERIAL-123` (verified with cat).
- Symlinked dirs recurse too (verified: 15-deep nested copy; kernel symlink limit terminates it, so no infinite loop, but an attacker template can reach ~/.ssh/id_rsa, ~/.aws/credentials, ~/.npmrc etc. with absolute symlinks and have the content land in the project the user may commit/push).

Pre-existing on master. The `--template <url>` path is the realistic trigger: attacker pushes a repo with absolute symlinks.

Screenshot: (not applicable)

History:
- security: opened

## SEC-003: `--template` local path has zero validation — arbitrary directory copy + raw node error on file input

- Status: ACCEPTED  (-> DEF-009)  # --template path zero validation; add dir-check + clean error  # ACCEPTED -> DEF-009 — --template path zero validation; add dir-check + clean error
- Severity: LOW
- Found by: security
- Phase: 3

What I found: project `name` gets 5 validation checks (src/new-command.js:228-248) but the `--template` path does not. Non-URL templates are `resolve()`d and only checked with `existsSync` (src/new-command.js:267-280). There is no "must be a directory" check and no confinement.

Expected: template path is validated (directory, not a system/sensitive dir, not a file), errors are clean.

Actual:

- `armada new app --template /tmp/secprobe/secret.txt --yes` (a file) crashes with an uncaught raw node error: `ENOTDIR: not a directory, scandir '/tmp/secprobe/secret.txt'` + `check permissions on the target directory` (exit 1). Leaks internal state; no actionable message.
- `--template /tmp/secprobe/tmpl2` copies the whole dir into the project (verified). `--template /etc` or `--template ~/.ssh` would copy those trees wholesale into the new project (user-requested, but nothing warns or confines).
- `--template .` resolves to cwd and would recursively copy the entire current repo.

Screenshot: (not applicable)

History:
- security: opened

## SEC-004: npm tarball silently drops all template dotfiles — .gitignore (incl. .env protection) and .gitkeep never ship

- Status: ACCEPTED  (-> DEF-010)  # npm tarball drops template dotfiles; fix files glob to include .*  # ACCEPTED -> DEF-010 — npm tarball drops template dotfiles; fix files glob to include .*
- Severity: MEDIUM
- Found by: security
- Phase: 3

What I found: `package.json` `files` whitelist includes `"starter"` (package.json:21), but npm-packlist's default ignore rules drop every dotfile. `npm pack --dry-run` output contains NO `.gitignore` and NO `.gitkeep` entries under `starter/` — only regular files.

Expected: the templates' tracked dotfiles ship; generated projects get the templates' .gitignore (which is the only `.env` protection for ml-training) and the empty dirs (`data/`, `notebooks/`, `figures/`) via .gitkeep.

Actual:

- `npm pack --dry-run` (this repo): tarball lists `starter/api-service/package.json`, `src/server.ts`, etc. but not `starter/api-service/.gitignore`; `starter/ml-training/.gitignore` (contains `.env`) absent; all 5 `.gitkeep` files absent.
- Control experiment: package with `"files":["sub"]`, `sub/.gitignore` + `sub/plain.txt` → tarball contains only `sub/plain.txt`.
- Consequence: every `armada new` project ships without any .gitignore — `node_modules/`, `dist/`, `__pycache__/` and critically `.env` are unprotected, so users can accidentally commit secrets; `data/`/`notebooks/`/`figures/` dirs are never created.

Screenshot: (not applicable)

History:
- security: opened

## SEC-005: cloneTemplate temp dir leaked on error paths — cloned template (possibly private) persists world-readable in system temp

- Status: ACCEPTED  (-> DEF-011)  # cloneTemplate temp dir leak on error paths; wrap in try/finally  # ACCEPTED -> DEF-011 — cloneTemplate temp dir leak on error paths; wrap in try/finally
- Severity: LOW
- Found by: security
- Phase: 3

What I found: `cloneTemplate` (src/new-command.js:113-125) clones into a predictable name `join(tmpdir(), "armada-cc-" + Date.now())` with default umask perms. Cleanup (`rmSync`, src/new-command.js:346-349) runs only on the success path AFTER render. Any early return between clone and cleanup leaks the full clone.

Expected: temp clone removed on every path (success, config error, render error, throw).

Actual: demonstrated end-to-end with a local smart-HTTP git server:

- `armada new app --template http://127.0.0.1:8767/repo.git --config /tmp/secprobe/nope.json --yes` → clone succeeds → `resolveVariables` returns null on missing config → `runNew` returns 1 at src/new-command.js:339-340 → cleanup never runs.
- Leftover verified: `/var/folders/.../T/armada-cc-1785975764540/README.md` (`# tmpl`) remains, dir mode `drwxr-xr-x` (world-readable on a Linux `/tmp`; macOS parent tmpdir is 700 so exposure is OS-dependent).
- Any throw between clone and cleanup (e.g. render failure) has the same effect. Failed clones are cleaned by git itself (verified) and the success path cleans up.

Screenshot: (not applicable)

History:
- security: opened


## SEC-006: DEF-007 JSON validation does not block the original SEC-001 injection (fix bypass)

- Status: ACCEPTED  (-> DEF-014)
- Severity: MEDIUM
- Found by: security
- Phase: 4

What I found: re-ran the exact SEC-001 PoC from the Phase 3 finding against the fixed code. The malicious `--config` description value `", "scripts": {"preinstall": "echo PWNED >> /tmp/secprobe/pwned.txt"}, "private": "", "dummy": "` produced `Created app/` (EXIT=0) and the rendered `app/package.json` still contains the attacker-injected `"scripts": {"preinstall": ...}` block (verified via cat). The DEF-007 check (src/new-command.js:401-415) runs `JSON.parse` on the rendered file, but the original attack value is crafted to remain syntactically valid JSON — the parse succeeds, the injected preinstall lifecycle script survives, and `npm install` in the generated project would execute it (arbitrary command execution on the victim machine). The fix rejects only values that BREAK JSON structure; it does not detect injected keys.

Expected: DEF-007 blocks the original SEC-001 attack; rendered package.json is rejected or stripped of injected structure.

Actual: the accepted fix (DEF-007) is bypassable by the original PoC as-is. The error path that does trigger (verified with a JSON-breaking value `x\", y`) prints `rendered package.json is not valid JSON ... at <abs path>` and removes the target dir — so the check works for malformed output but not for valid-JSON injection. Error message leaks the absolute path but not the value (no info leak).

Screenshot: (not applicable)

History:
- orchestrator: accepted -> DEF-014 (reopened DEF-007; needs stronger fix)
- security: opened


## SEC-007: Unescaped substitution residual — stored XSS into rendered HTML/JSX/MD, invalid TOML/LaTeX

- Status: ACCEPTED  (-> DEF-015)
- Severity: LOW
- Found by: security
- Phase: 4

What I found: DEF-007 only checks `JSON_VALIDATE_FILES` (`package.json`, `tsconfig.json`). Other sinks are not validated: `index.html` title (web-app), `App.tsx` JSX (web-app), README.md (all templates), `pyproject.toml` (ml-training), `paper.tex` (research-paper). A description value `<script>alert(document.cookie)</script>` lands raw in rendered README.md and would land in `index.html` title. A stray `"` in description breaks pyproject.toml/paper.tex structure.

Expected: high-risk sinks validate output; user gets clear error instead of broken HTML/TOMX/TeX.

Actual: bypasses DEF-007 entirely — files are written with unescaped values.

History:
- orchestrator: accepted -> DEF-015
- security: opened

## SEC-008: Test suite leaks 390+ `armada-cc-test*` dirs into system temp

- Status: ACCEPTED  (-> DEF-016)
- Severity: LOW
- Found by: security
- Phase: 4

What I found: `tests/new-cookiecutter.test.js` (lines 11, 50, 84, 124, 141) creates temp dirs without cleanup. After `node --test 'tests/*.test.js'` completes, `os.tmpdir()` has hundreds of leftover `armada-cc-test*` dirs.

Expected: tests clean up temp dirs; CI runs don't leave artifacts.

Actual: 390+ leftover dirs verified after suite.

History:
- orchestrator: accepted -> DEF-014
- security: opened
