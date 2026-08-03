import { execFile } from "node:child_process"

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

  const bg = env.OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS === "true"
  checks.push({
    name: "background dispatch",
    status: "pass",
    detail: bg
      ? "OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true (native parallel background subagents)"
      : "OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS not set — parallel background dispatch disabled (inline fallback)",
  })

  checks.push({ name: "node", status: "pass", detail: process.version })
  return checks
}
