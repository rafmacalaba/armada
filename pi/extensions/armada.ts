/**
 * armada — pi extension
 *
 * Surfaces the armada CLI inside pi:
 * - `armada_fleet` / `armada_status` LLM-callable tools (read-only CLI calls)
 * - `/armada-fleet`, `/armada-status`, `/armada-doctor` commands with a status widget
 * - A guard that confirms force-pushes while a voyage is active
 *
 * CLI resolution: prefers the `src/cli.js` shipped with this package (works for
 * npm/git pi-package installs without a global bin), falls back to `armada` on PATH.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execFile as execFileCb, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, writeFile, unlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { promisify } from "node:util";
import { agentNameFor, ROLES } from "../../src/role-display.js";

const execFile = promisify(execFileCb);
const TIMEOUT_MS = 30_000;
const MAX_BUFFER = 10 * 1024 * 1024;

/** Package root (dir containing package.json), or null if it cannot be derived. */
function packageRoot(): string | null {
  try {
    // This file lives at <root>/pi/extensions/armada.ts
    return fileURLToPath(new URL("../../", import.meta.url));
  } catch {
    return null;
  }
}

function resolveCli(): { cmd: string; baseArgs: string[] } {
  const root = packageRoot();
  if (root) {
    const cli = join(root, "src", "cli.js");
    if (existsSync(cli)) return { cmd: process.execPath, baseArgs: [cli] };
  }
  return { cmd: "armada", baseArgs: [] };
}

async function runArmada(args: string[], cwd?: string): Promise<string> {
  const { cmd, baseArgs } = resolveCli();
  try {
    const { stdout } = await execFile(cmd, [...baseArgs, ...args], {
      cwd,
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
    });
    return stdout.trim() || "(no output)";
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      throw new Error(
        "armada CLI not found. Install it with `npm install -g @rafamacalaba/armada`, then run `armada doctor`.",
      );
    }
    throw new Error(err?.stderr?.trim() || String(err?.message || err));
  }
}

function widgetFrom(output: string, title: string): string[] {
  const lines = output.split("\n").filter((l) => l.trim().length > 0);
  return [title, ...lines.slice(0, 8)];
}

// ---- Subagent dispatch -----------------------------------------------------
//
// Armada's workflow is orchestration: the Commodore dispatches ship-role
// subagents (Galleon, Clipper, Corvette, ...) with task specs and runs
// independent phases in parallel. This tool spawns pi subprocesses for the
// fleet defined in `.pi/agents/<ship-name>.md` (scaffolded by `armada init
// --harness pi`), giving each dispatch an isolated context window.

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;
const PER_TASK_OUTPUT_CAP = 50 * 1024;

interface FleetAgent {
  name: string;
  model?: string;
  body: string;
}

/** Parse a pi agent markdown file: frontmatter (name/model) + body. */
function parseAgentFile(text: string, fallbackName: string): FleetAgent {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { name: fallbackName, body: text };
  const frontmatter = match[1];
  const modelMatch = frontmatter.match(/^model:\s*["']?([^\n"']+)["']?\s*$/m);
  const nameMatch = frontmatter.match(/^name:\s*["']?([^\n"']+)["']?\s*$/m);
  return {
    name: nameMatch?.[1]?.trim() || fallbackName,
    model: modelMatch?.[1]?.trim(),
    body: match[2].trim(),
  };
}

/**
 * Resolve a fleet agent by armada role ("backend-dev") or ship name
 * ("galleon"). Looks in the project's .pi/agents first (armada-managed,
 * role-overridable), then the user-level agent dir.
 */
function resolveFleetAgent(cwd: string, roleOrShip: string): FleetAgent | null {
  const ship = ROLES.includes(roleOrShip) ? agentNameFor(roleOrShip) : roleOrShip.toLowerCase();
  const candidates = [
    join(cwd, ".pi", "agents", `${ship}.md`),
    join(cwd, ".pi", "agents", `${roleOrShip}.md`),
    join(cwd, ".pi", "agents", `${ship.toLowerCase()}.md`),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return parseAgentFile(readFileSync(path, "utf8"), ship);
    }
  }
  return null;
}

/** Re-invokes pi the same way this process was started (node or bundled bin). */
function piInvocation(args: string[]): { command: string; args: string[] } {
  const script = process.argv[1];
  if (script && !script.startsWith("/$bunfs/root/") && existsSync(script)) {
    return { command: process.execPath, args: [script, ...args] };
  }
  return { command: "pi", args };
}

interface DispatchResult {
  role: string;
  ok: boolean;
  output: string;
  error?: string;
  usage: { turns: number; input: number; output: number; cost: number };
}

/** Run one pi subprocess for a fleet agent, JSON mode, return final assistant text. */
async function runFleetAgent(
  agent: FleetAgent,
  role: string,
  task: string,
  cwd: string,
  signal: AbortSignal | undefined,
): Promise<DispatchResult> {
  const usage = { turns: 0, input: 0, output: 0, cost: 0 };
  const args: string[] = ["--mode", "json", "-p", "--no-session"];
  if (agent.model) args.push("--model", agent.model);

  let promptFile: string | null = null;
  let promptDir: string | null = null;
  if (agent.body) {
    promptDir = await mkdtemp(join(tmpdir(), "armada-dispatch-"));
    promptFile = join(promptDir, `prompt-${agent.name}.md`);
    await writeFile(promptFile, agent.body, "utf8");
    args.push("--append-system-prompt", promptFile);
  }
  args.push(`Task: ${task}`);

  try {
    let output = "";
    let stderr = "";
    let stopReason: string | undefined;
    let errorMessage: string | undefined;

    const exitCode = await new Promise<number>((resolve) => {
      const inv = piInvocation(args);
      const proc = spawn(inv.command, inv.args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
      let buffer = "";
      const onLine = (line: string) => {
        if (!line.trim()) return;
        let event: any;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }
        if (event.type === "message_end" && event.message?.role === "assistant") {
          usage.turns++;
          const msg = event.message;
          usage.input += msg.usage?.input || 0;
          usage.output += msg.usage?.output || 0;
          usage.cost += msg.usage?.cost?.total || 0;
          if (msg.stopReason) stopReason = msg.stopReason;
          if (msg.errorMessage) errorMessage = msg.errorMessage;
          for (const part of msg.content ?? []) {
            if (part.type === "text" && part.text) output = part.text;
          }
        }
      };
      proc.stdout.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) onLine(line);
      });
      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      proc.on("close", (code) => {
        if (buffer.trim()) onLine(buffer);
        resolve(code ?? 0);
      });
      proc.on("error", () => resolve(1));
      if (signal) {
        const kill = () => {
          proc.kill("SIGTERM");
          setTimeout(() => proc.kill("SIGKILL"), 5000);
        };
        if (signal.aborted) kill();
        else signal.addEventListener("abort", kill, { once: true });
      }
    });

    const failed = exitCode !== 0 || stopReason === "error" || stopReason === "aborted";
    return {
      role,
      ok: !failed,
      output: output || "(no output)",
      error: failed ? errorMessage || stderr || `exit code ${exitCode}` : undefined,
      usage,
    };
  } finally {
    if (promptFile) await unlink(promptFile).catch(() => {});
    if (promptDir) await rm(promptDir, { recursive: true, force: true }).catch(() => {});
  }
}

function formatUsage(u: DispatchResult["usage"]): string {
  const parts = [`${u.turns} turns`, `in ${u.input}`, `out ${u.output}`];
  if (u.cost) parts.push(`$${u.cost.toFixed(4)}`);
  return parts.join(", ");
}

function truncate(text: string): string {
  if (Buffer.byteLength(text, "utf8") <= PER_TASK_OUTPUT_CAP) return text;
  return `${text.slice(0, PER_TASK_OUTPUT_CAP)}\n\n[output truncated]`;
}

export default function (pi: ExtensionAPI) {
  // ---- LLM-callable tools --------------------------------------------------

  pi.registerTool({
    name: "armada_fleet",
    label: "Armada Fleet",
    description:
      "Show active armada voyages: feature lanes, current phase, gate status, staleness, and cost. Read-only.",
    promptSnippet: "armada_fleet — show active armada voyages (lanes, phases, gate status)",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const out = await runArmada(["fleet"], ctx.cwd);
      return { content: [{ type: "text", text: out }], details: {} };
    },
  });

  pi.registerTool({
    name: "armada_status",
    label: "Armada Status",
    description:
      "Report armada repository state as JSON: active feature, voyage runs, ledgers. Read-only. Run from a repo with an armada manifest.",
    promptSnippet: "armada_status — report armada state (manifest, voyages, ledgers) as JSON",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const out = await runArmada(["status", "--json"], ctx.cwd);
      return { content: [{ type: "text", text: out }], details: {} };
    },
  });

  // ---- Commands ------------------------------------------------------------

  pi.registerCommand("armada-fleet", {
    description: "Show active armada voyages",
    handler: async (_args, ctx) => {
      const out = await runArmada(["fleet"], ctx.cwd);
      ctx.ui.setWidget("armada", widgetFrom(out, "armada fleet"));
      ctx.ui.notify("Fleet status updated", "info");
    },
  });

  pi.registerCommand("armada-status", {
    description: "Show armada repository status",
    handler: async (_args, ctx) => {
      const out = await runArmada(["status"], ctx.cwd);
      ctx.ui.setWidget("armada", widgetFrom(out, "armada status"));
      ctx.ui.notify("Status updated", "info");
    },
  });

  pi.registerCommand("armada-doctor", {
    description: "Check the armada environment (CLI, opencode, models)",
    handler: async (_args, ctx) => {
      const out = await runArmada(["doctor"], ctx.cwd);
      ctx.ui.notify(out, "info");
    },
  });

  // ---- Subagent dispatch tool ----------------------------------------------

  pi.registerTool({
    name: "armada_dispatch",
    label: "Armada Dispatch",
    description:
      "Dispatch armada fleet subagents with isolated context. Roles: orchestrator, backend-dev, " +
      "frontend-dev, qa, adversary, security, docs, architect (ship names also accepted: galleon, " +
      "clipper, corvette, xebec, frigate, caravel, bark). Modes: single {role, task} or parallel " +
      "{tasks: [{role, task}]}. Requires .pi/agents/*.md (run `armada init` with the pi harness) or " +
      "user-level agents in ~/.pi/agent/agents. Read the armada-task-spec skill before dispatching.",
    promptSnippet: "armada_dispatch — dispatch fleet subagents (single or parallel) with isolated context",
    parameters: Type.Object({
      role: Type.Optional(Type.String({ description: "Fleet role for single mode" })),
      task: Type.Optional(Type.String({ description: "Task spec for the agent (single mode)" })),
      tasks: Type.Optional(
        Type.Array(
          Type.Object({
            role: Type.String({ description: "Fleet role to dispatch" }),
            task: Type.String({ description: "Task spec for this agent" }),
          }),
          { description: "Parallel dispatch: run all tasks concurrently (max 8)" },
        ),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const resolveOrError = (role: string) => {
        if (!resolveFleetAgent(ctx.cwd, role)) {
          return {
            role,
            ok: false,
            output: "",
            error:
              `No fleet agent for "${role}". Expected .pi/agents/${agentNameFor(
                ROLES.includes(role) ? role : "backend-dev",
              )}.md — scaffold with 'armada init' (pi harness) or define ~/.pi/agent/agents/${role}.md.`,
            usage: { turns: 0, input: 0, output: 0, cost: 0 },
          } as DispatchResult;
        }
        return null;
      };

      if (params.tasks?.length) {
        if (params.tasks.length > MAX_PARALLEL_TASKS) {
          return {
            content: [{ type: "text", text: `Too many parallel tasks (${params.tasks.length}). Max is ${MAX_PARALLEL_TASKS}.` }],
            details: {},
          };
        }
        const resolved = params.tasks.map((t) => resolveFleetAgent(ctx.cwd, t.role));
        const missing = params.tasks.filter((_, i) => !resolved[i]);
        if (missing.length) {
          return {
            content: [{ type: "text", text: missing.map((t) => resolveOrError(t.role)!.error).join("\n") }],
            details: {},
            isError: true,
          };
        }
        const results: DispatchResult[] = new Array(params.tasks.length);
        let next = 0;
        const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, params.tasks.length) }, async () => {
          while (next < params.tasks.length) {
            const i = next++;
            const t = params.tasks![i];
            results[i] = await runFleetAgent(resolved[i]!, t.role, t.task, ctx.cwd, signal);
          }
        });
        await Promise.all(workers);
        const failed = results.filter((r) => !r.ok);
        const summary = results
          .map((r) => `### ${r.role}: ${r.ok ? "completed" : "failed"}\n\n${truncate(r.ok ? r.output : r.error || r.output)}`)
          .join("\n\n---\n\n");
        const total = results.reduce(
          (acc, r) => ({
            turns: acc.turns + r.usage.turns,
            input: acc.input + r.usage.input,
            output: acc.output + r.usage.output,
            cost: acc.cost + r.usage.cost,
          }),
          { turns: 0, input: 0, output: 0, cost: 0 },
        );
        return {
          content: [
            {
              type: "text",
              text:
                `Parallel dispatch: ${results.length - failed.length}/${results.length} succeeded ` +
                `(${formatUsage(total)}).\n\n${summary}`,
            },
          ],
          details: { results },
        };
      }

      if (params.role && params.task) {
        const agent = resolveFleetAgent(ctx.cwd, params.role);
        if (!agent) {
          return { content: [{ type: "text", text: resolveOrError(params.role)!.error! }], details: {}, isError: true };
        }
        const result = await runFleetAgent(agent, params.role, params.task, ctx.cwd, signal);
        if (!result.ok) {
          return {
            content: [{ type: "text", text: `${params.role} failed: ${result.error || result.output}` }],
            details: { results: [result] },
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: `${result.output}\n\n---\n${params.role}: ${formatUsage(result.usage)}` }],
          details: { results: [result] },
        };
      }

      return {
        content: [{ type: "text", text: "Provide either {role, task} (single) or {tasks: [...]} (parallel)." }],
        details: {},
      };
    },
  });

  // ---- Resource discovery --------------------------------------------------
  //
  // In armada-managed repos, contribute the bundled skills and pi prompt
  // templates so the armada workflow is first-class in pi sessions.

  pi.on("resources_discover", async (event, _ctx) => {
    const root = packageRoot();
    if (!root) return;
    const managed =
      existsSync(join(event.cwd, "armada.yaml")) || existsSync(join(event.cwd, "armada", "armada.yaml"));
    if (!managed) return;
    const skillPaths = join(root, "src", "skills");
    const promptPaths = join(root, "pi", "prompts");
    return {
      skillPaths: existsSync(skillPaths) ? [skillPaths] : [],
      promptPaths: existsSync(promptPaths) ? [promptPaths] : [],
    };
  });

  // ---- Guard ---------------------------------------------------------------

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;
    const cmd = String(event.input?.command ?? "");
    if (!/\bgit\s+push\s+(--force(-with-lease)?|-f)\b/.test(cmd)) return;
    // Headless modes cannot confirm; leave CI flows alone.
    if (!ctx.hasUI) return;
    const ok = await ctx.ui.confirm("armada guard", `Allow force-push?\n\n${cmd}`);
    if (!ok) return { block: true, reason: "armada guard: force-push rejected" };
  });
}
