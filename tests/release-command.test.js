import { test } from "node:test"
import assert from "node:assert"

import { validateVersion, regenChangelog, releaseStep1, releaseStep2, productionInjection } from "../src/release-command.js"

// -- validateVersion --

test("validateVersion: accepts valid semver strictly greater than current", () => {
  assert.doesNotThrow(() => validateVersion("1.2.0", "1.1.0"))
  assert.doesNotThrow(() => validateVersion("2.0.0", "1.9.9"))
  assert.doesNotThrow(() => validateVersion("1.1.1", "1.1.0"))
})

test("validateVersion: rejects malformed version strings", () => {
  assert.throws(() => validateVersion("not-a-version", "1.0.0"), /invalid|malformed|semver/i)
  assert.throws(() => validateVersion("1.2", "1.0.0"), /invalid|malformed|semver/i)
  assert.throws(() => validateVersion("", "1.0.0"), /invalid|malformed|semver/i)
  assert.throws(() => validateVersion("v1.2.0", "1.0.0"), /invalid|malformed|semver/i)
})

test("validateVersion: rejects equal version", () => {
  assert.throws(() => validateVersion("1.1.0", "1.1.0"), /greater/i)
})

test("validateVersion: rejects lower version", () => {
  assert.throws(() => validateVersion("1.0.9", "1.1.0"), /greater/i)
  assert.throws(() => validateVersion("0.9.0", "1.0.0"), /greater/i)
})

// -- regenChangelog (commits = [{hash, subject}], currentChangelog) --

test("regenChangelog: groups commits by conventional-commit prefix", () => {
  const commits = [
    { hash: "aaa1111", subject: "feat: add release command" },
    { hash: "bbb2222", subject: "feat: add step 2 flow" },
    { hash: "ccc3333", subject: "fix: version validation bug" },
    { hash: "ddd4444", subject: "chore: update deps" },
    { hash: "eee5555", subject: "docs: update RELEASING.md" },
  ]
  const result = regenChangelog(commits, "")
  assert.match(result, /## Features/)
  assert.match(result, /add release command/)
  assert.match(result, /add step 2 flow/)
  assert.match(result, /## Bug Fixes/)
  assert.match(result, /version validation bug/)
  assert.match(result, /## Chores/)
  assert.match(result, /update deps/)
  assert.match(result, /## Docs/)
  assert.match(result, /update RELEASING\.md/)
})

test("regenChangelog: preserves existing CHANGELOG content above the new section", () => {
  const existing = "# Changelog\n\nAll notable changes.\n\n## Features\n\n- old feature\n"
  const commits = [
    { hash: "aaa1111", subject: "feat: new feature" },
  ]
  const result = regenChangelog(commits, existing)
  // Existing preamble preserved
  assert.ok(result.includes("All notable changes"), "existing preamble preserved")
  // New section inserted before old sections
  const newIdx = result.indexOf("new feature")
  const oldIdx = result.indexOf("old feature")
  assert.ok(newIdx < oldIdx, "new feature appears before old feature")
})

test("regenChangelog: creates from preamble if currentChangelog is empty", () => {
  const commits = [
    { hash: "aaa1111", subject: "feat: first feature" },
  ]
  const result = regenChangelog(commits, "")
  assert.match(result, /^# Changelog/)
  assert.match(result, /## Features/)
  assert.match(result, /first feature/)
})

test("regenChangelog: creates from preamble if currentChangelog is undefined", () => {
  const commits = [
    { hash: "aaa1111", subject: "fix: bug fix" },
  ]
  const result = regenChangelog(commits)
  assert.match(result, /^# Changelog/)
  assert.match(result, /## Bug Fixes/)
  assert.match(result, /bug fix/)
})

// -- releaseStep1 dry-run --

test("releaseStep1 dry-run: no git commit called", async () => {
  const calls = []
  const injected = {
    getCurrentVersion: async () => "1.0.0",
    getCommitsSince: async () => [],
    readFile: async (path) => {
      if (path === "package.json") return JSON.stringify({ version: "1.0.0" })
      throw new Error(`unexpected read: ${path}`)
    },
    writeFile: async () => {},
    exec: async (cmd) => { calls.push(cmd); return { stdout: "", stderr: "", code: 0 } },
  }
  await releaseStep1("1.1.0", { dryRun: true, injected })
  const gitCommitCalls = calls.filter(c => c.includes("git commit"))
  assert.strictEqual(gitCommitCalls.length, 0, "no git commit in dry-run")
})

test("releaseStep1 dry-run: no git push called", async () => {
  const calls = []
  const injected = {
    getCurrentVersion: async () => "1.0.0",
    getCommitsSince: async () => [],
    readFile: async (path) => {
      if (path === "package.json") return JSON.stringify({ version: "1.0.0" })
      throw new Error(`unexpected read: ${path}`)
    },
    writeFile: async () => {},
    exec: async (cmd) => { calls.push(cmd); return { stdout: "", stderr: "", code: 0 } },
  }
  await releaseStep1("1.1.0", { dryRun: true, injected })
  const gitPushCalls = calls.filter(c => c.includes("git push"))
  assert.strictEqual(gitPushCalls.length, 0, "no git push in dry-run")
})

test("releaseStep1 dry-run: no writes to package.json or cli.js", async () => {
  const writtenFiles = []
  const injected = {
    getCurrentVersion: async () => "1.0.0",
    getCommitsSince: async () => [],
    readFile: async (path) => {
      if (path === "package.json") return JSON.stringify({ version: "1.0.0" })
      throw new Error(`unexpected read: ${path}`)
    },
    writeFile: async (path) => { writtenFiles.push(path) },
    exec: async () => ({ stdout: "", stderr: "", code: 0 }),
  }
  await releaseStep1("1.1.0", { dryRun: true, injected })
  const pkgWrites = writtenFiles.filter(f => f.includes("package.json"))
  const cliWrites = writtenFiles.filter(f => f.includes("cli.js"))
  assert.strictEqual(pkgWrites.length, 0, "no package.json writes in dry-run")
  assert.strictEqual(cliWrites.length, 0, "no cli.js writes in dry-run")
})

test("releaseStep1 dry-run: validates version rejects <= current", async () => {
  const injected = {
    getCurrentVersion: async () => "1.1.0",
    getCommitsSince: async () => [],
    readFile: async () => "",
    writeFile: async () => {},
    exec: async () => ({ stdout: "", stderr: "", code: 0 }),
  }
  await assert.rejects(
    () => releaseStep1("1.1.0", { dryRun: true, injected }),
    /greater/i,
    "should reject version equal to current"
  )
})

// -- releaseStep2 dry-run --

test("releaseStep2 dry-run: no tag writes", async () => {
  const calls = []
  const injected = {
    getCurrentVersion: async () => "1.1.0",
    getCommitsSince: async () => [],
    readFile: async () => "",
    writeFile: async () => {},
    exec: async (cmd) => { calls.push(cmd); return { stdout: "", stderr: "", code: 0 } },
  }
  await releaseStep2({ dryRun: true, injected })
  // Match the actual "git tag vX.Y.Z" command
  const tagWrites = calls.filter(c => c.includes("git tag v"))
  assert.strictEqual(tagWrites.length, 0, "no git tag v... in dry-run")
})

test("releaseStep2 dry-run: no gh release create", async () => {
  const calls = []
  const injected = {
    getCurrentVersion: async () => "1.1.0",
    getCommitsSince: async () => [],
    readFile: async () => "",
    writeFile: async () => {},
    exec: async (cmd) => { calls.push(cmd); return { stdout: "", stderr: "", code: 0 } },
  }
  await releaseStep2({ dryRun: true, injected })
  const ghReleaseCalls = calls.filter(c => c.includes("gh release create"))
  assert.strictEqual(ghReleaseCalls.length, 0, "no gh release create in dry-run")
})

test("releaseStep2 dry-run: NO npm invocation at all (stop-line enforced)", async () => {
  const calls = []
  const injected = {
    getCurrentVersion: async () => "1.1.0",
    getCommitsSince: async () => [],
    readFile: async () => "",
    writeFile: async () => {},
    exec: async (cmd) => { calls.push(cmd); return { stdout: "", stderr: "", code: 0 } },
  }
  await releaseStep2({ dryRun: true, injected })
  const npmCalls = calls.filter(c => c.includes("npm") || c.includes("publish"))
  assert.strictEqual(npmCalls.length, 0, "STOP-LINE: no npm invocation allowed in releaseStep2")
})

test("releaseStep2 dry-run: injected exec never called with npm or publish as arg", async () => {
  const calls = []
  const injected = {
    getCurrentVersion: async () => "1.1.0",
    getCommitsSince: async () => [],
    readFile: async () => "",
    writeFile: async () => {},
    exec: async (cmd) => { calls.push(cmd); return { stdout: "", stderr: "", code: 0 } },
  }
  await releaseStep2({ dryRun: true, injected })
  for (const cmd of calls) {
    assert.ok(!cmd.includes("npm"), `STOP-LINE: exec called with "npm" in cmd: ${cmd}`)
    assert.ok(!cmd.includes("publish"), `STOP-LINE: exec called with "publish" in cmd: ${cmd}`)
  }
})

// -- Stop-line audit: source check (static) --

test("stop-line audit: no npm publish in src/release-command.js", async () => {
  const { readFileSync } = await import("node:fs")
  const src = readFileSync(new URL("../src/release-command.js", import.meta.url), "utf8")
  assert.doesNotMatch(src, /npm publish/, "src/release-command.js must not contain 'npm publish'")
})

// -- productionInjection sanity --

test("productionInjection: exported and is an object with async exec function", () => {
  assert.ok(productionInjection, "productionInjection must be exported")
  assert.strictEqual(typeof productionInjection.exec, "function", "productionInjection.exec must be a function")
  assert.strictEqual(typeof productionInjection.readFile, "function", "productionInjection.readFile must be a function")
  assert.strictEqual(typeof productionInjection.writeFile, "function", "productionInjection.writeFile must be a function")
  assert.strictEqual(typeof productionInjection.getCurrentVersion, "function", "productionInjection.getCurrentVersion must be a function")
})
