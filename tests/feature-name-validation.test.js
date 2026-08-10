import { test } from "node:test"
import assert from "node:assert/strict"
import { validateName } from "../src/feature-commands.js"

test("validateName rejects names starting with voyage-", () => {
  assert.throws(() => validateName("voyage-foo"), /must not start with "voyage-"/)
  assert.throws(() => validateName("voyage-"), /must not start with "voyage-"/)
})

test("validateName accepts names ending with -voyage or containing voyage-", () => {
  assert.doesNotThrow(() => validateName("foo-voyage"))
  assert.doesNotThrow(() => validateName("my-voyage-foo"))
  assert.doesNotThrow(() => validateName("voyage"))
  assert.doesNotThrow(() => validateName("myfeature"))
})
