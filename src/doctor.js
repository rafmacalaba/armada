import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

function run(bin, args, env) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 15000, env }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: `${stdout ?? ""}${stderr ?? ""}`.trim() }))
  })
}

function firstLine(out, fallback) {
  const line = out.split("\n").map((l) => l.trim()).find((l) => l.length > 0)
  return line ?? fallback
}

export async function runDoctor(opts = {}) {
  const env = opts.env ?? process.env
  const checks = []

  const v = await run("opencode", ["--version"], env)
  checks.push({
    name: "opencode CLI",
    status: v.ok ? "pass" : "fail",
    detail: v.ok ? v.out || "exit 0" : firstLine(v.out, "command failed"),
  })

  const auth = await run("opencode", ["providers", "list"], env)
  checks.push({
    name: "providers auth",
    status: auth.ok ? "pass" : "fail",
    detail: firstLine(auth.out, auth.ok ? "exit 0" : "command failed"),
  })

  const orAuth = await run("opencode", ["auth", "list"], env)
  const hasOpenrouter = orAuth.ok && /openrouter/i.test(orAuth.out)
  const orEnv = typeof env.OPENROUTER_API_KEY === "string" && env.OPENROUTER_API_KEY.length > 0
  checks.push({
    name: "openrouter auth",
    status: hasOpenrouter || orEnv ? "pass" : "fail",
    detail: hasOpenrouter
      ? "openrouter credential found (opencode auth list)"
      : orEnv
        ? "OPENROUTER_API_KEY set"
        : "no openrouter credential — run /connect openrouter or set OPENROUTER_API_KEY (power preset needs it)",
  })

  const bg = env.OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS === "true"
  checks.push({
    name: "background dispatch",
    status: "pass",
    detail: bg
      ? "OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true (native parallel background subagents)"
      : "OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS not set — parallel background dispatch disabled (inline fallback)",
  })

  checks.push({ name: "node", status: "pass", detail: process.version })

  if (opts.project?.supervision?.plugin) {
    const pluginPath = join(opts.targetDir ?? ".", ".opencode/plugins/armada-supervision.js")
    checks.push({
      name: "supervision plugin",
      status: existsSync(pluginPath) ? "pass" : "fail",
      detail: existsSync(pluginPath)
        ? ".opencode/plugins/armada-supervision.js present"
        : "supervision.plugin is true but .opencode/plugins/armada-supervision.js missing — re-run armada init",
    })
  }
  if (opts.project?.supervision?.fleet) {
    const pluginPath = join(opts.targetDir ?? ".", ".opencode/plugins/armada-fleet.js")
    checks.push({
      name: "fleet tracker plugin",
      status: existsSync(pluginPath) ? "pass" : "fail",
      detail: existsSync(pluginPath)
        ? ".opencode/plugins/armada-fleet.js present"
        : "supervision.fleet is true but .opencode/plugins/armada-fleet.js missing — re-run armada init",
    })
  }
  return checks
}
