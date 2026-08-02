# Landing page hero for README

Date: 2026-08-01
Status: approved
Supersedes: nothing (replaces prior `docs/index.html` direction in `2026-08-01-landing-page-design.md` for the README aspect only; that file's old scope is moot — user picked README-hero instead)

## Goal

Make `README.md` read as a credible landing page for opencode-armada by inserting a
polished hero block at the very top. Existing content stays intact below the hero.
Smallest diff that gives biggest landing-page feel.

## Non-goals

- New build step, bundler, JS framework, or runtime dependency.
- Separate `docs/index.html` (abandoned in favor of README-internal hero).
- Replacing any existing section — only prepend, never rewrite below.
- Favicon, OG image, social preview, analytics, i18n.

## Deliverable

A hero block prepended to `README.md`, before the existing `# opencode-armada`
heading. Existing content below the hero is unchanged.

Hero structure (top to bottom, all GitHub-flavored markdown):

1. **Tagline** — one line under the H1. Terse, no marketing fluff. Echoes the
   existing one-liner: "Reproducible AI-engineer multi-agent teams for opencode."
2. **Badges row** — one line, inline images:
   - npm version: `https://img.shields.io/npm/v/opencode-armada`
   - license: `https://img.shields.io/npm/l/opencode-armada`
   - CI: `https://img.shields.io/github/actions/workflow/status/rafmacalaba/opencode-armada/ci.yml`
   - node: `https://img.shields.io/node/v/opencode-armada` (or skip if unknown)
3. **Three-line pitch** — what it is, who it's for, what makes it different.
   Lifted from existing README facts only. No new claims.
4. **Terminal demo** — single fenced bash block showing the happy path:
   `bunx opencode-armada init` → `opencode` → one example prompt. ~6 lines.
5. **Inline what-you-get** — 3 short bullets, then a `<sub>` link to the full
   "Why" section below ("read more ↓").

After the hero, the existing `## Why` section continues unchanged.

## Style constraints

- No emojis in code, comments, or content (per repo AGENTS.md).
- No HTML `<img>` beyond what GitHub shields render via markdown image syntax.
- Center-align the badges row using a markdown table or trailing-space hack if
  needed; if centering looks fragile, left-align — readability wins.
- Color, font, layout: GitHub defaults. No inline CSS.
- Total hero size target: ~25–35 lines.

## Sandbox

Same worktree as the rest of this branch: `feat/landing-page-armada` already
exists and has the untracked armada scaffold. Work continues on that branch.

## Verification

- `node --test 'tests/*.test.js'` stays green.
- README renders cleanly on GitHub (markdown lint clean, no broken image links,
  no broken internal anchors).
- Every fact in the hero is sourced from existing README/SPEC content — no
  invented claims.
- Existing sections (`## Why`, `## How you use it`, …, `## License`) appear
  verbatim below the hero.
- `git diff --stat` is dominated by `README.md` only.

## Risks

- Badge URLs may 404 if the workflow file or npm package name differs.
  Mitigation: verify each URL returns 200 before commit; drop or replace any
  that fail.
- GitHub does not center-align with markdown — hero may look left-heavy.
  Mitigation: keep hero visually balanced with bullet density, not alignment.
- Hero may bloat the "above the fold" of the README. Mitigation: cap at
  ~35 lines.

## Out of scope

- Replacing `## Why` or any other section.
- Adding screenshots, GIFs, or video.
- Building a docs site or any external landing page.
