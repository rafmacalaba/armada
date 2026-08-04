#!/usr/bin/env sh
# release-smoke.sh — Prove the npm-pack tarball alone is sufficient.
#
# Usage: scripts/release-smoke.sh [worktree-dir]
#   worktree-dir defaults to the directory containing this script's parent.
#
# Steps:
#   1. npm pack in the worktree → tarball.
#   2. npm install -g the tarball into a temp prefix.
#   3. Run --version, voyage --help, models from a NEUTRAL cwd (/tmp).
#   4. Assert expected output for each command.
#   5. Cleanup the temp prefix.
#
# Exit: 0 if all assertions pass; non-zero otherwise.

set -u

WORKTREE=""
if [ $# -ge 1 ]; then
  WORKTREE="$1"
else
  WORKTREE="$(cd "$(dirname "$0")/.." && pwd)"
fi

TMP_PREFIX="/tmp/armada-smoke-$$"
BIN="${TMP_PREFIX}/bin/armada"
NEUTRAL_CWD="/tmp"
PASS=0
FAIL=0

cleanup() {
  if [ -d "${TMP_PREFIX}" ]; then
    rm -rf "${TMP_PREFIX}"
  fi
}

pass() {
  PASS=$((PASS + 1))
  echo "  PASS: $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo "  FAIL: $1" >&2
}

echo "==> release-smoke.sh"
echo "    worktree : ${WORKTREE}"
echo "    tmp prefix: ${TMP_PREFIX}"

# Step 1: npm pack
echo ""
echo "--- Step 1: npm pack ---"
TARBALL=$(cd "${WORKTREE}" && npm pack 2>&1 | tail -1)
TARBALL_PATH="${WORKTREE}/${TARBALL}"
if [ ! -f "${TARBALL_PATH}" ]; then
  fail "tarball not found at ${TARBALL_PATH}"
  exit 1
fi
TARBALL_SIZE=$(wc -c < "${TARBALL_PATH}" | tr -d ' ')
echo "    tarball: ${TARBALL_PATH} (${TARBALL_SIZE} bytes)"
pass "tarball created"

# Step 2: install to temp prefix
echo ""
echo "--- Step 2: npm install to temp prefix ---"
INSTALL_OUT=$(npm install -g "${TARBALL_PATH}" --prefix "${TMP_PREFIX}" 2>&1)
if [ ! -x "${BIN}" ]; then
  fail "armada binary not found at ${BIN}"
  cleanup
  exit 1
fi
echo "    install output: ${INSTALL_OUT}"
pass "tarball installed to temp prefix"

# Step 3a: --version
echo ""
echo "--- Step 3a: armada --version ---"
VER_OUT=$(cd "${NEUTRAL_CWD}" && "${BIN}" --version 2>&1)
VER_EXIT=$?
echo "    output: ${VER_OUT}"
echo "    exit  : ${VER_EXIT}"
if [ "${VER_EXIT}" -ne 0 ]; then
  fail "--version exited ${VER_EXIT}"
else
  case "${VER_OUT}" in
    *"opencode-armada v"*) pass "--version shows opencode-armada v...";;
    *) fail "--version missing expected prefix";;
  esac
fi

# Step 3b: voyage --help
echo ""
echo "--- Step 3b: armada voyage --help ---"
VOYAGE_OUT=$(cd "${NEUTRAL_CWD}" && "${BIN}" voyage --help 2>&1)
VOYAGE_EXIT=$?
echo "    (last 10 lines)"
echo "${VOYAGE_OUT}" | tail -10 | sed 's/^/    /'
echo "    exit  : ${VOYAGE_EXIT}"
if [ "${VOYAGE_EXIT}" -ne 0 ]; then
  fail "voyage --help exited ${VOYAGE_EXIT}"
elif echo "${VOYAGE_OUT}" | grep -q "voyage"; then
  pass "voyage present in help output"
else
  fail "voyage not found in help output"
fi

# Step 3c: models — display names
echo ""
echo "--- Step 3c: armada models ---"
MODELS_OUT=$(cd "${NEUTRAL_CWD}" && "${BIN}" models 2>&1)
MODELS_EXIT=$?
echo "    (last 10 lines)"
echo "${MODELS_OUT}" | tail -10 | sed 's/^/    /'
echo "    exit  : ${MODELS_EXIT}"
if [ "${MODELS_EXIT}" -ne 0 ]; then
  fail "models exited ${MODELS_EXIT}"
else
  missing=""
  for name in Commodore Galleon Frigate; do
    if ! echo "${MODELS_OUT}" | grep -q "${name}"; then
      missing="${missing} ${name}"
    fi
  done
  if [ -z "${missing}" ]; then
    pass "display names present (Commodore, Galleon, Frigate)"
  else
    fail "missing display names:${missing}"
  fi
fi

# Summary
echo ""
echo "==> Results: ${PASS} passed, ${FAIL} failed"

# Cleanup
cleanup
echo "    temp prefix cleaned up"

if [ "${FAIL}" -gt 0 ]; then
  exit 1
fi
exit 0
