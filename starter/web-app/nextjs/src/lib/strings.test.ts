import { describe, expect, test } from "vitest"
import { toCapitalize } from "./strings"

describe("toCapitalize", () => {
  test("capitalizes the first letter", () => {
    expect(toCapitalize("hello")).toBe("Hello")
  })

  test("leaves already-capitalized strings unchanged", () => {
    expect(toCapitalize("Hello")).toBe("Hello")
  })

  test("handles empty string", () => {
    expect(toCapitalize("")).toBe("")
  })
})
