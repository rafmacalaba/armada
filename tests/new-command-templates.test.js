import { test } from "node:test"
import assert from "node:assert"
import { discoverVariables } from "../src/new-command.js"

test("discoverVariables parametrized by template dir", () => {
  for (const [dir, expected] of [
    ["./starter/blank", []],
    ["./starter/web-app", ["author_email", "author_name", "description", "node_version", "project_name"]],
    ["./starter/ml-training", ["author_email", "author_name", "description", "project_name", "python_version"]],
    ["./starter/research-paper", ["author_email", "author_name", "description", "project_name"]],
    ["./starter/api-service", ["author_email", "author_name", "description", "node_version", "project_name"]],
    ["./starter/cli-tool", ["author_email", "author_name", "description", "node_version", "project_name"]],
  ]) {
    assert.deepStrictEqual(discoverVariables(dir), expected, dir)
  }
})
