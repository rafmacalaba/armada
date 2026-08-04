import { test } from "node:test"
import assert from "node:assert"
import YAML from "yaml"
import { securityFindingTemplate, securityFindingEntry, defaultSecurityLedgerPath } from "../src/ledgers.js"
import { parseManifestYaml, DEFAULT_PLAYBOOK } from "../src/manifest.js"
import { renderManifestYaml, buildTeam } from "../src/generator.js"
import { ROLES, modelFor } from "../src/model-catalog.js"

// -- Template format --

test("securityFindingTemplate emits canonical entry format", () => {
  const tmpl = securityFindingTemplate("my-feature")
  assert.match(tmpl, /## SEC-###: Title/)
  assert.match(tmpl, /- Status: OPEN/)
  assert.match(tmpl, /- Severity: HIGH \| MEDIUM \| LOW/)
  assert.match(tmpl, /- Found by: security/)
  assert.match(tmpl, /- Phase: N/)
  assert.match(tmpl, /What I found: \.\.\./)
  assert.match(tmpl, /Expected: \.\.\./)
  assert.match(tmpl, /Actual: \.\.\./)
  assert.match(tmpl, /armada\/screenshots\/my-feature\/sec-###\.png/)
  assert.match(tmpl, /History:/)
  assert.match(tmpl, /- security: opened/)
})

test("securityFindingTemplate uses {feature} token when feature omitted", () => {
  const tmpl = securityFindingTemplate()
  assert.match(tmpl, /armada\/screenshots\/\{feature\}\/sec-###\.png/)
})

test("securityFindingTemplate format mirrors adversarial entry from renderAgentsMd", () => {
  // Verify the template has the same structural fields as adversarial entry:
  // title header, metadata fields, what/expected/actual, screenshot, history/disposition
  const tmpl = securityFindingTemplate("f")
  // Header with ID
  assert.match(tmpl, /^## SEC-###: Title/)
  // Metadata: status/severity/found-by/phase (mirrors adversarial Session/Suggested severity)
  assert.match(tmpl, /\n- Status:/)
  assert.match(tmpl, /\n- Severity:/)
  assert.match(tmpl, /\n- Found by:/)
  assert.match(tmpl, /\n- Phase:/)
  // Body fields
  assert.match(tmpl, /\nWhat I found:/)
  assert.match(tmpl, /\nExpected:/)
  assert.match(tmpl, /\nActual:/)
  // Screenshot path
  assert.match(tmpl, /Screenshot:/)
  // History (mirrors Disposition)
  assert.match(tmpl, /\nHistory:/)
})

// -- securityFindingEntry --

test("securityFindingEntry renders filled entry", () => {
  const entry = securityFindingEntry(7, "SQL injection in login", {
    status: "OPEN",
    severity: "HIGH",
    foundBy: "security",
    phase: 2,
    found: "Unsanitized user input in login query",
    expected: "Parameterized queries or input validation",
    actual: "Raw string interpolation into SQL",
    screenshot: "armada/screenshots/auth/sec-007.png",
    history: ["security: opened"],
  })
  assert.match(entry, /^## SEC-007: SQL injection in login/)
  assert.match(entry, /- Status: OPEN/)
  assert.match(entry, /- Severity: HIGH/)
  assert.match(entry, /- Found by: security/)
  assert.match(entry, /- Phase: 2/)
  assert.match(entry, /What I found: Unsanitized user input in login query/)
  assert.match(entry, /Expected: Parameterized queries or input validation/)
  assert.match(entry, /Actual: Raw string interpolation into SQL/)
  assert.match(entry, /Screenshot: armada\/screenshots\/auth\/sec-007\.png/)
  assert.match(entry, /History:/)
  assert.match(entry, /- security: opened/)
})

test("securityFindingEntry zero-pads single and double digit numbers", () => {
  assert.match(securityFindingEntry(1, "X"), /^## SEC-001:/)
  assert.match(securityFindingEntry(42, "X"), /^## SEC-042:/)
  assert.match(securityFindingEntry(999, "X"), /^## SEC-999:/)
})

test("securityFindingEntry defaults omitted fields", () => {
  const entry = securityFindingEntry(1, "Test")
  assert.match(entry, /- Status: OPEN/)
  assert.match(entry, /- Severity: MEDIUM/)
  assert.match(entry, /- Found by: security/)
  assert.match(entry, /- Phase: N/)
  assert.match(entry, /What I found: \.\.\./)
  assert.match(entry, /Expected: \.\.\./)
  assert.match(entry, /Actual: \.\.\./)
  assert.doesNotMatch(entry, /Screenshot:/)
  assert.match(entry, /- security: opened/)
})

test("securityFindingEntry no fields arg defaults everything", () => {
  const entry = securityFindingEntry(1, "Test")
  assert.match(entry, /- Status: OPEN/)
  assert.match(entry, /- Severity: MEDIUM/)
  assert.match(entry, /What I found: \.\.\./)
  assert.match(entry, /- security: opened/)
})

// -- defaultSecurityLedgerPath --

test("defaultSecurityLedgerPath returns per-feature path", () => {
  assert.strictEqual(
    defaultSecurityLedgerPath("my-feature"),
    "armada/ledgers/my-feature/SECURITY_FINDINGS.md"
  )
})

test("defaultSecurityLedgerPath works with {feature} token", () => {
  assert.strictEqual(
    defaultSecurityLedgerPath("{feature}"),
    "armada/ledgers/{feature}/SECURITY_FINDINGS.md"
  )
})

// -- DEFAULT_PLAYBOOK --

test("DEFAULT_PLAYBOOK has securityLedger with per-feature path", () => {
  assert.strictEqual(
    DEFAULT_PLAYBOOK.securityLedger.file,
    "armada/ledgers/{feature}/SECURITY_FINDINGS.md"
  )
  assert.strictEqual(
    DEFAULT_PLAYBOOK.securityLedger.shared,
    "armada/ledgers/shared/SECURITY_FINDINGS.md"
  )
  assert.strictEqual(DEFAULT_PLAYBOOK.securityLedger.owner, "security")
})

test("DEFAULT_PLAYBOOK securityLedger lives alongside defectLedger and adversarialLedger", () => {
  assert.ok(DEFAULT_PLAYBOOK.defectLedger)
  assert.ok(DEFAULT_PLAYBOOK.adversarialLedger)
  assert.ok(DEFAULT_PLAYBOOK.securityLedger)
  assert.notStrictEqual(DEFAULT_PLAYBOOK.securityLedger.file, DEFAULT_PLAYBOOK.defectLedger.file)
  assert.notStrictEqual(DEFAULT_PLAYBOOK.securityLedger.file, DEFAULT_PLAYBOOK.adversarialLedger.file)
})

// -- Schema parse (parseManifestYaml accepts securityLedger in playbook) --

test("parseManifestYaml accepts securityLedger in playbook", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: free",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
    "playbook:",
    "  securityLedger:",
    "    file: armada/ledgers/myapp/SECURITY_FINDINGS.md",
    "    shared: armada/ledgers/shared/SECURITY_FINDINGS.md",
    "    owner: security",
    "",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.ok(parsed.playbook.securityLedger, "playbook.securityLedger must be parsed")
  assert.strictEqual(parsed.playbook.securityLedger.file, "armada/ledgers/myapp/SECURITY_FINDINGS.md")
  assert.strictEqual(parsed.playbook.securityLedger.shared, "armada/ledgers/shared/SECURITY_FINDINGS.md")
  assert.strictEqual(parsed.playbook.securityLedger.owner, "security")
})

test("parseManifestYaml securityLedger absent defaults to undefined", () => {
  const yaml = [
    "project:",
    "  name: t",
    "  budget: free",
    "team:",
    "  - role: qa",
    "    model: x",
    "    enabled: true",
    "",
  ].join("\n")
  const parsed = parseManifestYaml(yaml)
  assert.strictEqual(parsed.playbook.securityLedger, undefined)
})

// -- Round-trip: write YAML -> parse -> render -> parse -> equal --

test("securityLedger round-trips through renderManifestYaml", () => {
  const manifest = {
    project: {
      name: "t", budget: "balanced",
      stack: {},
    },
    team: [{ role: "qa", model: "x", fallback: null, enabled: true }],
    playbook: {
      securityLedger: {
        file: "armada/ledgers/custom/SECURITY_FINDINGS.md",
        shared: "armada/ledgers/shared/SECURITY_FINDINGS.md",
        owner: "security",
      },
    },
  }
  const yaml = renderManifestYaml(manifest, buildTeam(manifest))
  assert.match(yaml, /playbook:/)
  assert.match(yaml, /securityLedger:/)
  assert.match(yaml, /file: "armada\/ledgers\/custom\/SECURITY_FINDINGS\.md"/)
  // Parse back
  const reparsed = parseManifestYaml(yaml)
  assert.ok(reparsed.playbook.securityLedger)
  assert.strictEqual(reparsed.playbook.securityLedger.file, "armada/ledgers/custom/SECURITY_FINDINGS.md")
  assert.strictEqual(reparsed.playbook.securityLedger.shared, "armada/ledgers/shared/SECURITY_FINDINGS.md")
  assert.strictEqual(reparsed.playbook.securityLedger.owner, "security")
})

test("securityLedger round-trip: re-render from reparsed is identical", () => {
  const manifest = {
    project: {
      name: "t", budget: "balanced",
      stack: {},
    },
    team: [{ role: "qa", model: "x", fallback: null, enabled: true }],
    playbook: {
      securityLedger: {
        file: "armada/ledgers/custom/SECURITY_FINDINGS.md",
        shared: "armada/ledgers/shared/SECURITY_FINDINGS.md",
        owner: "security",
      },
    },
  }
  const yaml1 = renderManifestYaml(manifest, buildTeam(manifest))
  const reparsed = parseManifestYaml(yaml1)
  const yaml2 = renderManifestYaml(reparsed, buildTeam(reparsed))
  assert.strictEqual(yaml1, yaml2, "re-rendered YAML must be byte-identical")
})

test("renderManifestYaml omits playbook when securityLedger is absent", () => {
  const manifest = {
    project: {
      name: "t", budget: "balanced",
      stack: {},
    },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "balanced"), fallback: null, enabled: true })),
    playbook: {},
  }
  const yaml = renderManifestYaml(manifest, buildTeam(manifest))
  assert.doesNotMatch(yaml, /^playbook:/m)
})

test("renderManifestYaml securityLedger does not break full team round-trip", () => {
  const manifest = {
    project: {
      name: "t", budget: "balanced",
      stack: { frontend: "nextjs", backend: "python-fastapi", database: "postgres",
        testing: "playwright", srcDirs: ["src", "backend"], languages: ["typescript", "python"] },
    },
    team: ROLES.map((r) => ({ role: r, model: modelFor(r, "balanced"), fallback: null, enabled: true })),
    playbook: {
      securityLedger: {
        file: "armada/ledgers/myapp/SECURITY_FINDINGS.md",
        shared: "armada/ledgers/shared/SECURITY_FINDINGS.md",
        owner: "security",
      },
    },
  }
  const yaml = renderManifestYaml(manifest, buildTeam(manifest))
  const reparsed = parseManifestYaml(yaml)
  assert.strictEqual(reparsed.project.name, "t")
  assert.strictEqual(reparsed.project.budget, "balanced")
  assert.strictEqual(reparsed.team.length, ROLES.length)
  assert.ok(reparsed.playbook.securityLedger)
  assert.strictEqual(reparsed.playbook.securityLedger.file, "armada/ledgers/myapp/SECURITY_FINDINGS.md")
})
