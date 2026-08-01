import { mkdtempSync, writeFileSync, mkdirSync, chmodSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFile } from "node:child_process"

const CLI = join(process.cwd(), "src/cli.js")

export function makeTempRepo(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "armada-e2e-"))
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel)
    mkdirSync(join(dir, rel.split("/").slice(0, -1).join("/")), { recursive: true })
    writeFileSync(p, content, "utf8")
  }
  return dir
}

export function makeBin(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "armada-bin-"))
  for (const [name, content] of Object.entries(files)) {
    const p = join(dir, name)
    writeFileSync(p, content, "utf8")
    chmodSync(p, 0o755)
  }
  return dir
}

export function runCli(args, opts = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env, ...(opts.env || {}) }
    execFile(process.execPath, [CLI, ...args], { cwd: opts.cwd || process.cwd(), env },
      (err, stdout, stderr) => resolve({ code: err?.code ?? 0, stdout, stderr }))
  })
}
