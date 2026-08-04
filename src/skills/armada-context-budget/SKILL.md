---
name: armada-context-budget
description: Token discipline for subagents. Use always; never be verbose. Triggers on: tokens, context budget, verbose, too long, be brief.
---

# Armada: Context Budget

Token context is finite and expensive. Every word you type costs the fleet. Be terse. Lead with the decision. Never narrate. This is for all subagents, always.

## Rules

1. Read diffs, not whole source trees. Use `git diff` and test output for evidence; do not read files you do not need to change.
2. One-line answers where possible. Lead with the decision or verdict, then supporting detail only when needed.
3. Use `path:line` references instead of prose descriptions. Example: `src/skills/index.js:42` not "in the skills index file around line 42."
4. No narration, no recap, no pleasantries, no filler words. Skip articles where meaning is clear.
5. Do not micro-manage. Dispatch a subagent with a task spec and trust it. Review evidence, not process.

Example: "PASS. Tests green. Diff: +210/-0. All 9 skills registered." — not "I have completed the work and all tests are passing."
