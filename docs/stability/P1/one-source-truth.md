# P1 — One Source of Truth

Each conceptual domain has exactly one source-of-truth file. Cross-references included.

## Schema

- Source: `src/manifest.js:104-198` (`parseManifestYaml`)
- Schema declaration: `src/manifest.js:201-218` (`MANIFEST_SCHEMA`)
- Validation: `src/manifest.js:10-102` (validateRequirementsFile, validatePermissionsDeep, validatePrompt, validateSkills, parseBoolean)
- Used by: `src/cli.js:301-309` (init --from-armada), `src/cli.js:507-512` (uninstall)

## Routing (command dispatch)

- Source: `src/cli.js:135-213` (`main()` switch)
- HELP text: `src/cli.js:44-86` (must match switch cases)
- No second routing table exists. All commands dispatch through single switch.

## Permissions

- Source: `src/generator.js:25-60` (`rolePermissions` map)
- Rendered into: `.opencode/agent/*.md` frontmatter (via `renderAgentFile`)
- Validated: `src/manifest.js:47-54` (`validatePermissions`)
- Tested: `tests/scaffold.test.js:717-766` (orchestrator, backend-dev, qa permissions)

## Ownership (file no-clobber)

- Source: `src/scaffold.js:360-398` (openCodeJson, AGENTS.md merge, requirementsFile no-clobber)
- `opencode.json`: absent-only (`src/scaffold.js:362`)
- `AGENTS.md`: marker-based merge (`src/scaffold.js:369-391`)
- `REQUIREMENTS.md` / custom: absent-only (`src/scaffold.js:394-398`)
- `armada.yaml`: always overwrite (`src/scaffold.js:401`)

## Version

- Source: `src/cli.js:42` (`export const VERSION = "0.9.2"`)
- Mirrored: `package.json:3` (via `RELEASING.md:21-23` two-version rule)
- Rendered: `src/cli.js:44` (HELP), `src/cli.js:191` (--version output)
- Doctor check: `src/doctor.js:136` (uses `--version` from running binary)

## Terminology

- Source: `src/role-display.js:6-15` (`DISPLAY` map: role key → ship name)
- Ship names: commodore, galleon, clipper, corvette, xebec, frigate, caravel, bark
- Role keys: orchestrator, backend-dev, frontend-dev, qa, adversary, security, docs, architect
- Agent files: `src/scaffold.js:297-298` uses `agentNameFor()` → ship name
- No other file defines role-to-name mapping
