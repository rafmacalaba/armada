#!/usr/bin/env node
// {{ cookiecutter.project_name }}
// {{ cookiecutter.description }}

import { Command } from "commander"

const program = new Command()

program
  .name("{{ cookiecutter.project_name }}")
  .description("{{ cookiecutter.description }}")
  .version("0.0.0")

program
  .command("hello")
  .description("Say hello")
  .action(() => {
    console.log("Hello from {{ cookiecutter.project_name }}!")
  })

program.parse()
