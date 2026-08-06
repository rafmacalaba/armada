import { test } from "node:test"
import assert from "node:assert"
import { discoverVariables } from "../src/new-command.js"

test("discoverVariables blank template returns empty list", () => {
  const vars = discoverVariables("./starter/blank")
  assert.deepStrictEqual(vars, [])
})

test("discoverVariables web-app template returns expected variables", () => {
  const vars = discoverVariables("./starter/web-app")
  assert.deepStrictEqual(vars, [
    "author_email",
    "author_name",
    "description",
    "node_version",
    "project_name",
  ])
})

test("discoverVariables ml-training template returns expected variables", () => {
  const vars = discoverVariables("./starter/ml-training")
  assert.deepStrictEqual(vars, [
    "author_email",
    "author_name",
    "description",
    "project_name",
    "python_version",
  ])
})

test("discoverVariables research-paper template returns expected variables", () => {
  const vars = discoverVariables("./starter/research-paper")
  assert.deepStrictEqual(vars, [
    "author_email",
    "author_name",
    "description",
    "project_name",
  ])
})

test("discoverVariables api-service template returns expected variables", () => {
  const vars = discoverVariables("./starter/api-service")
  assert.deepStrictEqual(vars, [
    "author_email",
    "author_name",
    "description",
    "node_version",
    "project_name",
  ])
})

test("discoverVariables cli-tool template returns expected variables", () => {
  const vars = discoverVariables("./starter/cli-tool")
  assert.deepStrictEqual(vars, [
    "author_email",
    "author_name",
    "description",
    "node_version",
    "project_name",
  ])
})
