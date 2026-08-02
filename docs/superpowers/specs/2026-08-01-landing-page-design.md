# Landing page for opencode-armada

Date: 2026-08-01
Status: approved
Scope: single deliverable, one-off

## Goal

Add a simple static landing page for opencode-armada, demonstrating the tool on
its own repo (dogfood). The page lives in the repo, the work itself happens in
a sandboxed worktree so the main branch stays clean. The worktree pattern is
reusable for any future TODO.md item.

## Non-goals

- Marketing site, blog, or docs site. One page.
- Build system, bundler, or JavaScript framework.
- Extending armada to generate pages.
- Persisting the sandboxed scaffold output (rm after the dogfood check).

## Deliverable

- `docs/index.html` — static, single file, no JS, no build.
  - Sections: hero, why (4 bullets lifted from README), quick start (code
    block from README), features table (init / models / doctor / ping /
    uninstall), footer (MIT + repo link).
  - Style: system font stack, dark/light via `prefers-color-scheme`, navy/teal
    accent, responsive. ~200–300 lines.
- Dogfood evidence: terminal output from a successful `armada init` run, then
  removed.

## Sandbox

- Worktree: `git worktree add /tmp/armada-webpage -b feat/landing-page main`
- All edits happen in the worktree.
- Worktree is discarded after the deliverable is reported.
- Pattern is reusable: the same `git worktree add` flow will be used for TODO.md
  work later.

## Dogfood step

In the worktree, run:

```bash
node src/cli.js init --from-armada armada.yaml --target examples/sandbox-init
```

Capture the output as evidence the CLI works on its own repo, then
`rm -rf examples/sandbox-init` so it does not pollute the diff.

## Verification

- `node --test 'tests/*.test.js'` stays green.
- Open `docs/index.html` (file:// or headless chrome) — confirm sections
  render, code block is selectable, dark mode works if system preference is
  dark.
- `git diff --stat` on the worktree shows only `docs/index.html` (+ a few
  hundred lines).

## Risks

- Brand color guess (navy/teal). Reversible — single CSS variable.
- The dogfood `init` may print warnings on the worktree root because the repo
  already has its own instruction files. That is expected and confirms the
  no-clobber rule.

## Out of scope

- Favicon, OG image, social previews.
- Analytics, tracking.
- i18n.
