import { test } from "node:test"
import assert from "node:assert"
import { existsSync, readFileSync, mkdtempSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import { spawnCli, makeTempGitRepo, makeBin } from "./helpers.js"

const FAKE_TMUX = `#!/bin/sh
D="\${FAKE_TMUX_STATE:-/tmp/tmux-fake}"
mkdir -p "$D" 2>/dev/null

parse_session() {
  p=""
  for a in "$@"; do
    [ "$p" = "-t" ] && { printf '%s' "$a"; return; }
    [ "$p" = "-s" ] && { printf '%s' "$a"; return; }
    p="$a"
  done
  printf '%s' "none"
}

case "$1" in
  has-session)
    S=$(parse_session "$@")
    [ -f "$D/$S.exists" ] && exit 0 || exit 1
    ;;
  new-session)
    S=$(parse_session "$@")
    touch "$D/$S.exists"
    echo "0" > "$D/$S.polls"
    echo "0" > "$D/$S.prompts"
    exit 0
    ;;
  capture-pane)
    S=$(parse_session "$@")
    c=0
    [ -f "$D/$S.polls" ] && c=$(cat "$D/$S.polls")
    c=$((c + 1))
    echo "$c" > "$D/$S.polls"

    pc=0
    [ -f "$D/$S.prompts" ] && pc=$(cat "$D/$S.prompts")

    if [ "$c" -ge 3 ]; then
      printf "tab agents\\nctrl+p\\n"
      if [ "$pc" -ge 1 ] && [ "$c" -ge 6 ]; then
        printf "thinking...\\n"
      fi
    else
      printf "Loading...\\n"
    fi
    exit 0
    ;;
  send-keys)
    S=$(parse_session "$@")
    for a in "$@"; do printf '%s\\n' "$a"; done >> "$D/$S.sendlog"
    for a in "$@"; do
      if [ "$a" = "-l" ]; then
        pc=0
        [ -f "$D/$S.prompts" ] && pc=$(cat "$D/$S.prompts")
        pc=$((pc + 1))
        echo "$pc" > "$D/$S.prompts"
        break
      fi
    done
    exit 0
    ;;
esac
`

const FAKE_OPENCODE = `#!/bin/sh
exit 0
`

test("armada voyage happy path: creates lane, arms it, boots ship", async () => {
  const mainDir = makeTempGitRepo({ "README.md": "# test" })

  // Step 1: arm the main repo
  const initResult = await spawnCli(["init", "--yes", "--yolo", "--budget", "balanced", "--target", mainDir])
  assert.strictEqual(initResult.code, 0, `init stderr: ${initResult.stderr}`)
  assert.ok(existsSync(join(mainDir, ".opencode", "agent", "commodore.md")), "commodore.md must exist in main repo")

  // Step 2: create worktree feature
  const wtResult = await spawnCli(["feature", "new", "voyage-test", "--worktree", "--target", mainDir])
  assert.strictEqual(wtResult.code, 0, `feature new stderr: ${wtResult.stderr}`)
  const lanePath = join(mainDir, "sandbox", "voyage-test")
  assert.ok(existsSync(lanePath), "worktree must exist")

  // Assert branch exists
  const branchCheck = spawnSync("git", ["rev-parse", "--verify", "feat/voyage-test"], { cwd: mainDir, encoding: "utf8" })
  assert.strictEqual(branchCheck.status, 0, `branch feat/voyage-test not found: ${branchCheck.stderr}`)

  // Assert contract exists
  const contractPath = join(lanePath, "armada", "contracts", "voyage-test.md")
  assert.ok(existsSync(contractPath), "contract must exist in worktree")

  // Step 3: arm the lane
  const laneInitResult = await spawnCli(["init", "--yes", "--yolo", "--budget", "balanced", "--target", lanePath])
  assert.strictEqual(laneInitResult.code, 0, `lane init stderr: ${laneInitResult.stderr}`)
  assert.ok(existsSync(join(lanePath, ".opencode", "agent", "commodore.md")), "commodore.md must exist in lane")

  // Step 4: voyage the lane with fake tmux and opencode
  const stateDir = mkdtempSync(join(tmpdir(), "tmux-fake-"))
  const binDir = makeBin({ tmux: FAKE_TMUX, opencode: FAKE_OPENCODE })
  const env = {
    FAKE_TMUX_STATE: stateDir,
    PATH: `${binDir}:${process.env.PATH}`,
  }

  const voyageResult = await spawnCli(["voyage", lanePath], { env, cwd: mainDir })
  assert.strictEqual(voyageResult.code, 0, `voyage stderr: ${voyageResult.stderr}`)

  // Assert: tmux new-session was called (ship booted)
  const sessionExistsFile = join(stateDir, "voyage-test.exists")
  assert.ok(existsSync(sessionExistsFile), "tmux new-session must have been called (ship booted)")

  // Assert: send-keys sent the voyage prompt (prompt registered)
  const sendlogFile = join(stateDir, "voyage-test.sendlog")
  assert.ok(existsSync(sendlogFile), "sendlog must exist (prompt must have been sent)")
  const sendlog = readFileSync(sendlogFile, "utf8")
  assert.ok(sendlog.length > 0, "sendlog must be non-empty")
  assert.match(sendlog, /REQUIREMENTS|Voyage|contract/i, "sendlog must contain voyage prompt")
})

test("refusal: feature new --worktree from inside a worktree exits non-zero with clear error", async () => {
  const mainDir = makeTempGitRepo({ "README.md": "# test" })

  // Arm the main repo
  await spawnCli(["init", "--yes", "--yolo", "--budget", "balanced", "--target", mainDir])

  // Create first worktree
  const firstResult = await spawnCli(["feature", "new", "outer", "--worktree", "--target", mainDir])
  assert.strictEqual(firstResult.code, 0, `first worktree stderr: ${firstResult.stderr}`)
  const outerPath = join(mainDir, "sandbox", "outer")
  assert.ok(existsSync(outerPath), "first worktree must exist")

  // Try to create nested worktree from INSIDE the first worktree
  const nestedResult = await spawnCli(["feature", "new", "nested", "--worktree"], { cwd: outerPath })
  assert.notStrictEqual(nestedResult.code, 0, "nested worktree must be refused")
  assert.match(
    nestedResult.stderr,
    /nested|already inside a worktree|inside a worktree|not allowed/i,
    `stderr must mention nested/nested rejection: ${nestedResult.stderr}`
  )
})

test("subdir of main repo is allowed (not a nested worktree)", async () => {
  const mainDir = makeTempGitRepo({ "README.md": "# test" })

  // Arm the main repo
  await spawnCli(["init", "--yes", "--yolo", "--budget", "balanced", "--target", mainDir])

  // Create subdirectory
  const subDir = join(mainDir, "packages", "lib")
  mkdirSync(subDir, { recursive: true })
  const result = await spawnCli(["feature", "new", "from-subdir", "--worktree"], { cwd: subDir })
  assert.strictEqual(result.code, 0, `feature new stderr: ${result.stderr}`)

  // Assert worktree exists relative to mainDir (not relative to subdir)
  const lanePath = join(mainDir, "sandbox", "from-subdir")
  assert.ok(existsSync(lanePath), "worktree must exist under main repo sandbox/")

  // Assert branch exists in main repo
  const branchCheck = spawnSync("git", ["rev-parse", "--verify", "feat/from-subdir"], { cwd: mainDir, encoding: "utf8" })
  assert.strictEqual(branchCheck.status, 0, `branch feat/from-subdir not found: ${branchCheck.stderr}`)
})
