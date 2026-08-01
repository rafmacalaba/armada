import { execFile } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

function run(bin, args, env) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 15000, env }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: `${stdout ?? ""}${stderr ?? ""}`.trim() }))
  })
}

export async function runDoctor(opts = {}) {
  const env = opts.env || process.env
  const configPath = opts.configPath || join(homedir(), ".config/opencode/opencode.json")
  const checks = []

  const v = await run("opencode", ["--version"], env)
  checks.push({ name: "opencode CLI", status: v.ok ? "pass" : "fail", detail: v.ok ? v.out : "not found on PATH" })

  const auth = await run("opencode", ["providers", "list"], env)
  checks.push({ name: "providers auth", status: auth.ok ? "pass" : "fail", detail: auth.ok ? "logged in" : "no providers configured" })

  let plugin = "missing"
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf8")
        .replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")
      const cfg = JSON.parse(raw)
      const plugins = cfg.plugin || []
      plugin = plugins.some((p) => String(p).includes("oh-my-opencode-slim")) ? "present" : "missing"
    } catch {
      plugin = "unparseable"
    }
  }
  checks.push({ name: "omo-slim plugin", status: plugin === "present" ? "pass" : "fail", detail: `plugin[] ${plugin}` })

  const bg = env.OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS
  checks.push({
    name: "background subagents",
    status: bg === "true" ? "pass" : "warn",
    detail: bg === "true" ? "enabled" : "set OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true",
  })

  checks.push({ name: "node", status: "pass", detail: process.version })
  return checks
}
