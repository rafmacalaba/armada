/**
 * atomic — atomic file I/O for state persistence.
 *
 * Writes use temp-file + rename to guarantee that readers never see
 * a partial or corrupted file. Reads are safe (return null if missing).
 *
 * @module state/atomic
 */

import { writeFileSync, renameSync, readFileSync, existsSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
import { randomBytes } from "node:crypto"

// ---- helpers ---------------------------------------------------------------

function randomSuffix() {
  return randomBytes(8).toString("hex")
}

// ---- public API ------------------------------------------------------------

/**
 * Write `data` to `filePath` atomically.
 * Writes to a temp file in the same directory, then renames over the target.
 * If the rename fails, the original file is left untouched.
 *
 * @param {string} filePath - absolute path to target file
 * @param {string} data - string content to write
 * @returns {Promise<void>}
 */
export function writeAtomic(filePath, data) {
  return new Promise((resolve, reject) => {
    try {
      const dir = dirname(filePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const tmpPath = join(dir, `.${randomSuffix()}.tmp`)
      writeFileSync(tmpPath, data, "utf8")
      renameSync(tmpPath, filePath)
      resolve()
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Read a file safely. Returns the content as a string, or null if the file
 * does not exist.
 *
 * @param {string} filePath - absolute path
 * @returns {string|null}
 */
export function readSafe(filePath) {
  if (!existsSync(filePath)) return null
  return readFileSync(filePath, "utf8")
}
