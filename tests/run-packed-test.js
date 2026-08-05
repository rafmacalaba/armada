#!/usr/bin/env node
// Packed artifact install-and-run verification.
// Steps: npm pack -> npm install -g to temp prefix -> run --version/help -> assert binary matches.

import { execSync } from "node:child_process"
import { existsSync, readFileSync, unlinkSync, rmSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = resolve(fileURLToPath(import.meta.url), "..", "..")
const dock = resolve(__dirname)
const pkg = JSON.parse(readFileSync(join(dock, "package.json"), "utf8"))
const name = pkg.name
const version = pkg.version
const tarball = `${name}-${version}.tgz`

let tgz = null
let prefix = null
let ok = true

function log(msg) {
  process.stdout.write(msg + "\n")
}

function fail(msg) {
  process.stderr.write("FAIL: " + msg + "\n")
  ok = false
}

try {
  // 1. npm pack
  log(`[1/5] npm pack ${name}@${version} ...`)
  const packOut = execSync("npm pack --loglevel=error", {
    cwd: dock,
    encoding: "utf8",
    timeout: 60_000,
  }).trim()
  const lines = packOut.split("\n").filter(Boolean)
  tgz = lines[lines.length - 1]
  if (!tgz.endsWith(".tgz")) fail(`npm pack produced unexpected output: ${packOut}`)
  else if (!existsSync(join(dock, tgz))) fail(`${tgz} not found after npm pack`)
  else log(`  -> ${tgz}`)

  if (!ok) process.exit(1)

  // 2. install to fresh temp prefix
  log("[2/5] install to temp prefix ...")
  prefix = execSync("mktemp -d", { encoding: "utf8" }).trim()
  log(`  -> prefix=${prefix}`)

  execSync(
    `npm install -g --prefix "${prefix}" --loglevel=error --legacy-peer-deps "${join(dock, tgz)}"`,
    { timeout: 60_000, stdio: "pipe" }
  )

  const bin = join(prefix, "bin", "armada")
  if (!existsSync(bin)) fail(`armada binary not found at ${bin}`)
  else log(`  -> binary at ${bin}`)

  if (!ok) process.exit(1)

  // 3. run --version and help
  log("[3/5] run --version and help ...")
  const ver = execSync(`"${bin}" --version`, { encoding: "utf8", timeout: 10_000 }).trim()
  log(`  -> version: ${ver}`)
  if (!ver) fail("--version produced no output")

  const help = execSync(`"${bin}" help`, { encoding: "utf8", timeout: 10_000 })
  if (!help.includes("armada")) fail("help output does not reference armada")
  else log("  -> help OK")

  if (!ok) process.exit(1)

  // 4. assert installed binary is same as dock's src/cli.js (head -1)
  log("[4/5] assert binary matches dock src/cli.js ...")
  const dockCli = readFileSync(join(dock, "src", "cli.js"), "utf8").split("\n")[0]
  const installedCli = readFileSync(bin, "utf8").split("\n")[0]
  if (installedCli !== dockCli) fail("installed cli.js does not match dock src/cli.js line 1")
  else log("  -> match OK")

  if (!ok) process.exit(1)

  // 5. cleanup
  log("[5/5] cleanup ...")
  rmSync(prefix, { recursive: true, force: true })
  log("  -> prefix removed")

  log(`\nPASS: ${tarball} installed and runs in clean prefix.`)
} finally {
  // always clean up tgz from dock
  if (tgz) {
    try {
      unlinkSync(join(dock, tgz))
    } catch {}
  }
  // clean up prefix on failure
  if (prefix && !ok) {
    try {
      rmSync(prefix, { recursive: true, force: true })
    } catch {}
  }
}
