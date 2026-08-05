# Why armada exists

*The case for structured multi-agent engineering — and how armada implements it.*

---

## The state of AI coding agents

AI coding agents are transformative. Give one a codebase and a prompt, and it writes code,
refactors modules, adds tests — often faster than a human could type the same changes. But
watch closely and you see the gaps:

**They guess when they should ask.** An agent given "build the login page" will pick a framework,
choose an auth strategy, and wire it up — all without asking you whether you wanted OAuth or
email/password, whether the backend is REST or GraphQL, whether the design should match your
existing palette. The result is technically correct code that doesn't match what you wanted.

**They skip verification.** An agent that writes a function will often claim it works without
running the tests. If it does run them, it might fix the test to match the code instead of
fixing the code to match the spec. There is no separation between writing and reviewing —
the same agent that wrote the bug is the one declaring it fixed.

**They have no memory across sessions.** Kill the terminal, lose the context. The agent that
was halfway through a 5-phase feature implementation starts from scratch when you reopen the
session. Every crash costs you the entire conversation context.

**They have no boundaries.** A solo agent can touch any file. It can rewrite your CI config
while fixing a CSS bug. It can modify the database schema while adding a tooltip. There is no
concept of "this agent should only touch frontend files."

**They clobber your working tree.** A solo agent modifies files directly on your active working branch.
If it gets stuck halfway or breaks something, your main branch is left dirty and uncommitted.
Running multiple parallel tasks is impossible without nasty git collisions.

These aren't flaws in the models — they're flaws in how we deploy them. The fix isn't a smarter
model; it's a smarter **environment**.

---

## Three ideas that change the game

### Cookiecutter-style scaffolding

[Popularized by Cookiecutter](https://github.com/cookiecutter/cookiecutter), project template generators proved that the cleanest way to deliver structured, reproducible environments is zero-dependency file generation. armada applies Cookiecutter's core insight to the AI age: instead of requiring a heavy runtime plugin or complex daemon, armada generates native agent files, playbooks, and contract state directly into your repo. You run `armada init` once; your codebase owns the team.

### Harness engineering

[Coined by OpenAI](https://openai.com/index/harness-engineering/), harness engineering is the
insight that when an agent fails, the fix is rarely "try harder." It's: **what is the
environment missing, and how do we make the right behavior legible and enforceable?**

You engineer the *harness* around the agent:
- The repo structure (where do files live? what's the contract?)
- The instructions (what does each role do? what are the rules?)
- The invariants (what boundaries are mechanically enforced?)
- The feedback loops (how does the agent know if it succeeded?)

Humans steer; agents execute. The environment makes the right behavior the easy behavior.

### Loop engineering

[Popularized by Cobus Greyling](https://github.com/cobusgreyling/loop-engineering) and
crystallized by Boris Cherny at Anthropic: **"I don't prompt Claude anymore. I have loops
running that prompt Claude."**

Stop prompting agents one-off. Design loops that prompt the agents for you:
*scheduler -> triage -> sub-agents -> verification -> human gate -> merge.*

The agent isn't autonomous — it's a component in a control loop. The loop decides when to
dispatch, what to verify, when to gate, and when to ask for human judgment. The agent does
one thing well; the loop makes the decisions.

---

## How armada combines them

armada sits at the intersection: the **generator** builds the harness; the **orchestrator's
dispatch/gate/reconcile cycle** runs the loop.

### The harness (what armada generates)

When you run `armada init`, it writes:
- **Per-role agents** (`.opencode/agent/*.md`) with real permissions in the frontmatter —
  the orchestrator physically cannot edit code, security physically cannot write files
- **A playbook** (`AGENTS.md`) defining the team's rules, defect lifecycle, and phase gates
- **A contract stub** (`armada/REQUIREMENTS.md`) where you and the Commodore define
  phases, success criteria, and what "done" means
- **A state area** (`armada/state/`) that survives session crashes
- **Isolated Git worktrees** (`sandbox/<name>`) so feature voyages run on dedicated branches, keeping `main` pristine and enabling parallel execution

The permissions aren't aspirational. They're in the agent frontmatter and enforced by the
opencode SDK. The orchestrator's config literally says `edit: { "*": "deny" }`. It delegates
because it has to — not because the prompt asks nicely.

### The loop (what the orchestrator runs)

Once you approve the contract, the orchestrator runs a fixed control loop:

```
plan -> dispatch ready phases in parallel
     -> collect evidence (test runs, screenshots)
     -> gate: did the success criteria pass?
     -> advance to the next phase
     -> repeat until all phases pass
     -> QA end-to-end tests
     -> adversary hostile review
     -> defect triage
     -> done (PR created)
```

The loop has mechanical properties that matter:
- **Maker/checker split.** Developers write; QA and the adversary check. A maker never
  passes its own work.
- **Evidence, not reports.** Every arrow back to the orchestrator carries proof — a passing
  test run, a screenshot, a file:line citation. Never a claim of intent.
- **State is the loop's memory.** Every transition is written to disk. Kill the session,
  reopen, and the loop continues where it left off.
- **The Admiral (human) is a gate, not a driver.** The loop runs; it pauses only for judgment.

---

## What we learned building it

armada uses itself. The fleet (the 8 AI agents) build armada's own features through the same
contract/dispatch/gate workflow that any user would run.

### Real results

- **The fleet built armada's own session-based state system** in ~26 minutes, at a cost of $0.18,
  running fully autonomously with `--yolo` mode. It went from blank contract to working code
  with passing tests.
- **It surfaced a real permission deadlock** — a case where the Commodore's deny-all-edit
  rule conflicted with a state-write it needed to make. The fleet didn't silently fail; it asked
  the right question and the Admiral answered it.
- **It self-corrected 3 test failures** it introduced while writing its own code. The QA gate
  caught them; the loop sent the developer back; the developer fixed them.
- **Dogfood testing caught real bugs:** `buildTeam` silently ignoring manifest flags,
  `formatStack` crashing on empty stacks, catalog drift on live provider model IDs.

### The million-dollar property

A system that can improve itself. The fleet reviews armada's code (patrol), implements armada's
next feature (voyage), and gates everything on evidence. Every feature armada ships was built
by armada.

---

## Who is this for?

**Beginners** who want a structured way to work with AI coding agents. Instead of raw-dogging
a solo agent and hoping for the best, armada gives you a team with built-in quality gates. You
don't need to know how to write agent prompts or configure permissions — `armada init` handles
the setup, and the Commodore walks you through the rest.

**Experienced developers** who want reproducible, auditable AI-assisted development. The
manifest (`armada/armada.yaml`) is the source of truth: `armada init --from-armada armada/armada.yaml`
produces the identical team on any machine, every time. Evidence-gated phases mean your AI
output has proof attached, not just claims.

**Teams** who want to standardize how AI agents work across their org. One manifest, one team
definition, consistent quality gates. Every defect goes through a ledger. Every phase is
demonstrated by evidence. Every feature ends in a PR, not a local merge.

**Anyone exploring multi-agent AI engineering** who wants a working reference implementation.
armada's architecture combines harness engineering and loop engineering in a way that's concrete,
tested, and open source.

---

## Where is this going?

armada works with [opencode](https://opencode.ai) today — but the architecture is **harness-agnostic**.
The generator produces native agent files for the host runtime; swapping the runtime means adding a renderer, not a rewrite.

**The multi-harness vision:** the same team definition (`armada/armada.yaml`) generates native agents
for whatever AI coding tool you use. opencode is the reference implementation. Claude Code and
Codex renderers are next. Same Commodore, same boundaries, same evidence gates — different
host.

See the [roadmap](../TODO.md) for the full backlog. The highlights:
- **Multi-harness** — Claude Code and Codex renderers (same team, different runtimes)
- **Skills integration** — fleet-specific skills shipped into generated repos
- **Dashboard TUI** — real-time `armada fleet --watch`
- **Role roster tuning** — right-sizing the 8-role team based on real sessions

---

## Further reading

- [Getting Started](./getting-started.md) — install, first project, first feature
- [Architecture](../ARCHITECTURE.md) — the full technical deep dive
- [Self-Improvement](./self-improvement.md) — how armada uses itself to build itself
- OpenAI, [*Harness engineering*](https://openai.com/index/harness-engineering/)
- Anthropic, [*Building effective agents*](https://www.anthropic.com/engineering/building-effective-agents)
- Cobus Greyling, [*Loop Engineering*](https://github.com/cobusgreyling/loop-engineering)

