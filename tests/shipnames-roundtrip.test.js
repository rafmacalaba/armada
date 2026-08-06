import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

import { scaffold } from "../src/scaffold.js"
import { renderArmadaShipnamesPlugin, SHIPNAMES_PLUGIN_FILENAME, renderManifestYaml } from "../src/generator.js"
import { ROLES } from "../src/model-catalog.js"
import { modelFor } from "../src/model-catalog.js"
import { parseManifestYaml } from "../src/manifest.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, "..")

function makeManifest(dir, opts = {}) {
  return {
    targetDir: dir,
    project: {
      name: "roundtrip-test",
      budget: "balanced",
      browserTesting: false,
      devcontainer: false,
      useAgentBrowser: false,
      headless: false,
      yolo: false,
      supervision: { plugin: false, fleet: false, watchdog: false, shipnames: true, ...opts.supervision },
      requirementsFile: "armada/REQUIREMENTS.md",
      stack: {},
    },
    team: ROLES.map((role) => ({ role, model: modelFor(role, "balanced"), variant: null, enabled: true })),
    playbook: {},
  }
}

const PLUGIN_REL = ".opencode/plugins/armada-shipnames.js"

test("init -> parse -> init produces byte-identical plugin file", () => {
  const dir1 = mkdtempSync(join(tmpdir(), "shipnames-rt1-"))
  const dir2 = mkdtempSync(join(tmpdir(), "shipnames-rt2-"))
  try {
    const manifest1 = makeManifest(dir1)
    scaffold(manifest1, manifest1.project.stack, { gitignore: false })

    const pluginPath1 = join(dir1, PLUGIN_REL)
    assert.ok(existsSync(pluginPath1), "plugin written in first scaffold")

    // Parse armada.yaml back to manifest
    const yamlPath1 = join(dir1, "armada/armada.yaml")
    assert.ok(existsSync(yamlPath1), "armada.yaml written")
    const yamlText = readFileSync(yamlPath1, "utf8")
    const parsed = parseManifestYaml(yamlText, dir1)

    // Scaffold again from parsed manifest into second dir
    const manifest2 = makeManifest(dir2)
    manifest2.project.supervision.shipnames = parsed.project.supervision.shipnames
    scaffold(manifest2, manifest2.project.stack, { gitignore: false })

    const pluginPath2 = join(dir2, PLUGIN_REL)
    assert.ok(existsSync(pluginPath2), "plugin written in second scaffold")

    const content1 = readFileSync(pluginPath1, "utf8")
    const content2 = readFileSync(pluginPath2, "utf8")
    assert.strictEqual(content1, content2, "plugin files must be byte-identical across scaffold runs")
  } finally {
    try { rmSync(dir1, { recursive: true, force: true }) } catch {}
    try { rmSync(dir2, { recursive: true, force: true }) } catch {}
  }
})

test("rendered plugin parses as valid JS via new Function", () => {
  const src = renderArmadaShipnamesPlugin()
  // Strip the export keyword so new Function can parse it (module syntax not allowed in Function body)
  const body = src.replace(/^export /m, "")
  assert.doesNotThrow(() => {
    new Function(body)
  }, "rendered plugin source must be syntactically valid JS")
})

test("live scaffold: init --yes writes plugin with shipnames: true in manifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "shipnames-live-"))
  try {
    execFileSync(process.execPath, [join(PROJECT_ROOT, "src/cli.js"), "init", "--yes", "--target", dir], {
      cwd: PROJECT_ROOT,
      timeout: 30000,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    const pluginPath = join(dir, PLUGIN_REL)
    assert.ok(existsSync(pluginPath), "armada-shipnames.js written by init --yes")

    const content = readFileSync(pluginPath, "utf8")
    assert.ok(content.includes("ArmadaShipnames"), "plugin contains ArmadaShipnames export")
    assert.ok(content.includes("tool.execute.before"), "plugin hooks tool.execute.before")

    const yamlPath = join(dir, "armada/armada.yaml")
    assert.ok(existsSync(yamlPath), "armada.yaml written")
    const yaml = readFileSync(yamlPath, "utf8")
    assert.ok(yaml.includes("shipnames: true"), "manifest carries shipnames: true")
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
})

test("live scaffold: --no-shipnames skips plugin and sets manifest to false", () => {
  const dir = mkdtempSync(join(tmpdir(), "shipnames-no-"))
  try {
    execFileSync(process.execPath, [join(PROJECT_ROOT, "src/cli.js"), "init", "--yes", "--no-shipnames", "--target", dir], {
      cwd: PROJECT_ROOT,
      timeout: 30000,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    const pluginPath = join(dir, PLUGIN_REL)
    assert.ok(!existsSync(pluginPath), "armada-shipnames.js NOT written with --no-shipnames")

    const yamlPath = join(dir, "armada/armada.yaml")
    assert.ok(existsSync(yamlPath), "armada.yaml written")
    const yaml = readFileSync(yamlPath, "utf8")
    assert.ok(yaml.includes("shipnames: false"), "manifest carries shipnames: false")
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
})

test("scaffold: shipnames false skips plugin", () => {
  const dir = mkdtempSync(join(tmpdir(), "shipnames-false-"))
  try {
    const manifest = makeManifest(dir, { supervision: { shipnames: false } })
    scaffold(manifest, manifest.project.stack, { gitignore: false })

    const pluginPath = join(dir, PLUGIN_REL)
    assert.ok(!existsSync(pluginPath), "plugin not written when shipnames is false")
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
})
