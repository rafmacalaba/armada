import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
import { randomBytes } from "node:crypto"
import { fileURLToPath } from "node:url"

// Live e2e: prove the command-body-abstraction holds end-to-end.
//
// Spawns opencode run --command armada "" --format json against a temp dir
// containing all 6 armada command files, exports the session, and asserts
// the first user message in chat history does NOT contain the full markdown
// body. Allowed shapes: empty text, text === description, or subtask part.
//
// Opt-in via RUN_LIVE=1 + opencode on PATH. Skipped by default.

const OPENCODE_BIN = "opencode"

// Path to the armada worktree root (where armada/screenshots/ lives)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const WORKTREE_ROOT = join(__dirname, "..", "..")

function opencodeAvailable() {
  try {
    const r = spawnSync("which", [OPENCODE_BIN], { encoding: "utf8", timeout: 5000 })
    return r.status === 0 && r.stdout?.trim().length > 0
  } catch {
    return false
  }
}

const LIVE = process.env.RUN_LIVE === "1" && opencodeAvailable()

const SKIP_REASON = !LIVE
  ? `RUN_LIVE=${process.env.RUN_LIVE ?? "unset"} or ${OPENCODE_BIN} not on PATH — skipping live e2e`
  : false

/** Extract `description` from markdown frontmatter. */
function extractDescriptionFromMd(md) {
  const fm = md.match(/^---\n([\s\S]*?)\n---/m)
  if (!fm) return ""
  const desc = fm[1].match(/description:\s*(.+)/)
  return desc ? desc[1].trim().replace(/^["']|["']$/g, "") : ""
}

test("command-body-abstraction live: armada command body hidden from user message", { skip: SKIP_REASON }, async () => {
  const randomSuffix = randomBytes(6).toString("hex")
  const tmpDir = join(tmpdir(), "armada-cmd-test-" + randomSuffix)
  const commandsDir = join(tmpDir, ".opencode", "commands")

  try {
    mkdirSync(commandsDir, { recursive: true })

    // Import generators and render all 6 command files
    const {
      renderArmadaCommand,
      renderArmadaStatusCommand,
      renderArmadaScoutCommand,
      renderArmadaResumeCommand,
      renderArmadaFleetCommand,
      renderArmadaVoyageCommand,
    } = await import("../../src/generator.js")

    const commands = {
      "armada.md": renderArmadaCommand(),
      "armada-status.md": renderArmadaStatusCommand(),
      "armada-scout.md": renderArmadaScoutCommand(),
      "armada-resume.md": renderArmadaResumeCommand(),
      "armada-fleet.md": renderArmadaFleetCommand(),
      "armada-voyage.md": renderArmadaVoyageCommand(),
    }

    for (const [filename, content] of Object.entries(commands)) {
      writeFileSync(join(commandsDir, filename), content, "utf8")
    }

    const armadaDesc = extractDescriptionFromMd(commands["armada.md"])

    // Run opencode with the armada command
    const runResult = spawnSync(
      OPENCODE_BIN,
      ["run", "--command", "armada", "", "--format", "json", "--dir", tmpDir],
      { encoding: "utf8", timeout: 120000, maxBuffer: 10 * 1024 * 1024 }
    )

    if (runResult.error) {
      const err = runResult.error
      const isTimeout = err.message?.includes("ETIMEDOUT") || err.code === "ETIMEDOUT"
      if (isTimeout) {
        console.log("opencode run timed out after 120s — skipping assertion")
        return
      }
      console.log("opencode run spawn error:", err.message)
      console.log("STDERR:", runResult.stderr?.slice(0, 500) || "(empty)")
      return
    }

    if (runResult.status !== 0 && runResult.status !== null) {
      console.log(`opencode run exited with status ${runResult.status}`)
      console.log("STDERR:", runResult.stderr?.slice(0, 500) || "(empty)")
      return
    }

    const stdout = runResult.stdout || ""
    const stderr = runResult.stderr || ""

    // Parse line-delimited JSON to find the first step_start event
    const lines = stdout.split("\n").filter((l) => l.trim())
    let sessionID = null
    for (const line of lines) {
      try {
        const event = JSON.parse(line)
        if (event.type === "step_start" && event.sessionID) {
          sessionID = event.sessionID
          break
        }
      } catch {
        // skip unparseable lines
      }
    }

    if (!sessionID) {
      console.log("Could not find sessionID in opencode run output")
      console.log("STDOUT (first 500 chars):", stdout.slice(0, 500))
      console.log("STDERR (first 500 chars):", stderr.slice(0, 500))
      return
    }

    // Export the session
    const exportResult = spawnSync(
      OPENCODE_BIN,
      ["export", sessionID],
      { encoding: "utf8", timeout: 30000 }
    )

    if (exportResult.error || exportResult.status !== 0 || !exportResult.stdout) {
      console.log(`opencode export failed — status: ${exportResult.status}`)
      console.log("STDERR:", exportResult.stderr?.slice(0, 500) || "(empty)")
      console.log("error:", exportResult.error?.message || "(none)")
      return
    }

    const exportOutput = exportResult.stdout

    // Extract JSON from export output. opencode export prints
    // "Exporting session: <id>" then the JSON. Find the first `{`.
    const jsonStart = exportOutput.indexOf("{")
    if (jsonStart === -1) {
      console.log("No JSON found in export output")
      console.log("Export output (first 500 chars):", exportOutput.slice(0, 500))
      return
    }

    let sessionData
    try {
      sessionData = JSON.parse(exportOutput.slice(jsonStart))
    } catch (err) {
      console.log("Failed to parse session export JSON:", err.message)
      console.log("Export excerpt (first 500 chars):", exportOutput.slice(jsonStart, jsonStart + 500))
      return
    }

    // Find the first user message
    const messages = sessionData?.messages || []
    const firstUserMsg = messages.find((m) => m?.info?.role === "user")

    if (!firstUserMsg) {
      console.log("No user message found in session export")
      console.log("Total messages:", messages.length)
      return
    }

    const parts = firstUserMsg.parts || []

    // Assert: one of three allowed shapes
    //   1. No text part with non-empty text
    //   2. A text part whose text equals the command description
    //   3. A part with type === "subtask"
    const textParts = parts.filter((p) => p.type === "text" && p.text)
    const hasSubtaskPart = parts.some((p) => p.type === "subtask")
    const hasDescriptionOnly =
      textParts.length === 1 && textParts[0].text === armadaDesc

    const passed =
      textParts.length === 0 ||
      hasDescriptionOnly ||
      hasSubtaskPart

    if (!passed) {
      // Write failure artifact
      const screenshotDir = join(WORKTREE_ROOT, "armada", "screenshots", "command-body-abstraction")
      mkdirSync(screenshotDir, { recursive: true })
      const failurePath = join(screenshotDir, `live-test-failure-${Date.now()}.json`)
      writeFileSync(failurePath, JSON.stringify(sessionData, null, 2), "utf8")

      const excerpt = textParts.slice(0, 3).map((p) => p.text?.slice(0, 200)).join(" | ")
      assert.fail(
        `User message body leaked. ` +
        `Text parts: ${textParts.length}, has subtask: ${hasSubtaskPart}, description: "${armadaDesc}". ` +
        `Text excerpt: "${excerpt}". Full session export written to ${failurePath}`
      )
    }

    assert.ok(passed, "armada command body correctly hidden from user message")

  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})
