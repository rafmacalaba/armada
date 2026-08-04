// Security renderer tests — Phase 3: renderSecurityFinding in generator.js

import { test } from "node:test"
import assert from "node:assert"

import { renderSecurityFinding } from "../src/generator.js"

test("renderSecurityFinding emits canonical finding entry format", () => {
  const entry = renderSecurityFinding("my-feature", {
    num: 1,
    title: "Hardcoded API key in source",
    status: "OPEN",
    severity: "HIGH",
    phase: 2,
    found: "API key visible in config.ts",
    expected: "Key loaded from env var",
    actual: "Key is a string literal in source code",
    history: ["security: opened"],
  })
  assert.match(entry, /^## SEC-001: Hardcoded API key in source/)
  assert.match(entry, /- Status: OPEN/)
  assert.match(entry, /- Severity: HIGH/)
  assert.match(entry, /- Found by: security/)
  assert.match(entry, /- Phase: 2/)
  assert.match(entry, /What I found: API key visible in config\.ts/)
  assert.match(entry, /Expected: Key loaded from env var/)
  assert.match(entry, /Actual: Key is a string literal in source code/)
  assert.match(entry, /History:/)
  assert.match(entry, /- security: opened/)
})

test("renderSecurityFinding zero-pads single and double digit numbers", () => {
  assert.match(renderSecurityFinding("f", { num: 1, title: "X" }), /^## SEC-001:/)
  assert.match(renderSecurityFinding("f", { num: 42, title: "X" }), /^## SEC-042:/)
  assert.match(renderSecurityFinding("f", { num: 999, title: "X" }), /^## SEC-999:/)
})

test("renderSecurityFinding defaults omitted fields", () => {
  const entry = renderSecurityFinding("f", { num: 1, title: "Test" })
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

test("renderSecurityFinding includes screenshot when provided", () => {
  const entry = renderSecurityFinding("auth", {
    num: 3,
    title: "XSS in comment",
    screenshot: "armada/screenshots/auth/sec-003.png",
  })
  assert.match(entry, /Screenshot: armada\/screenshots\/auth\/sec-003\.png/)
})

test("renderSecurityFinding custom history respected", () => {
  const entry = renderSecurityFinding("f", {
    num: 1,
    title: "X",
    history: ["security: opened", "orchestrator: ACCEPTED"],
  })
  assert.match(entry, /- security: opened/)
  assert.match(entry, /- orchestrator: ACCEPTED/)
})

test("renderSecurityFinding custom foundBy respected", () => {
  const entry = renderSecurityFinding("f", {
    num: 1,
    title: "X",
    foundBy: "frigate",
  })
  assert.match(entry, /- Found by: frigate/)
})

test("renderSecurityFinding full fields all present", () => {
  const entry = renderSecurityFinding("api", {
    num: 5,
    title: "Missing CSRF",
    status: "ACCEPTED",
    severity: "LOW",
    foundBy: "frigate",
    phase: 1,
    found: "No CSRF tokens on POST",
    expected: "CSRF middleware enabled",
    actual: "Forms submit without tokens",
    screenshot: "armada/screenshots/api/sec-005.png",
    history: ["security: opened", "orchestrator: ACCEPTED"],
  })
  assert.match(entry, /^## SEC-005: Missing CSRF/)
  assert.match(entry, /- Status: ACCEPTED/)
  assert.match(entry, /- Severity: LOW/)
  assert.match(entry, /- Found by: frigate/)
  assert.match(entry, /- Phase: 1/)
  assert.match(entry, /What I found: No CSRF tokens on POST/)
  assert.match(entry, /Expected: CSRF middleware enabled/)
  assert.match(entry, /Actual: Forms submit without tokens/)
  assert.match(entry, /Screenshot: armada\/screenshots\/api\/sec-005\.png/)
  assert.match(entry, /- security: opened/)
  assert.match(entry, /- orchestrator: ACCEPTED/)
})
