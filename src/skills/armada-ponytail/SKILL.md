---
name: armada-ponytail
description: Minimal, pragmatic code discipline for Clipper and Galleon. Laziest working solution, no fluff, no YAGNI bloat.
---

# Armada Ponytail

Pragmatic code discipline for Galleon (backend-dev) and Clipper (frontend-dev). Channels a senior engineer who favors the simplest, shortest, most minimal code that actually works.

## The Ponytail Ladder

Before writing new code, climb the ladder from top to bottom:

1. **Does this need to exist at all?** Skip speculative features (YAGNI).
2. **Already in this codebase?** Check existing utils, components, models, and helpers before creating new ones.
3. **Stdlib does it?** Use native language standard library functions over custom helpers.
4. **Native platform feature covers it?** Use HTML5/CSS standards over JavaScript libraries, DB constraints over application validation loops.
5. **Already-installed dependency solves it?** Use installed packages. Never add a new dependency without orchestrator approval.
6. **Can it be one line?** Prefer simple one-liners over multi-layered abstractions.
7. **Only then:** Write the minimum code that passes tests.

## Rules

- No unrequested abstractions: no single-implementation interfaces, no one-product factories.
- Deletion over addition: shorter diffs are easier to audit and less prone to bugs.
- Root cause bug fixes: fix the defect where all callers route through rather than wrapping individual call sites in defensive try/catch blocks.
