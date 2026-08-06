# one-piece-restaurant — armada-built demo

A worked example of an armada-driven project: a static two-page landing site for
"The Thousand Sunny Galley", a One Piece themed restaurant. Built by an armada
multi-agent team, shipped with its contract, process ledgers, and evidence.

**Reference only — no run guarantee.** This tree was embedded as documentation of
the armada process, not as installable software. We did not verify it installs or
runs. Do not treat it as a supported example app.

## What this is

- A static site (HTML + CSS + one script), no build step, no dependencies.
- Pages: `index.html` (landing, menu, visit info) and `about.html` (story, crew).
- Produced by an armada voyage: orchestrator delegates, workers own slices,
  qa verifies — the full fleet model in miniature.

## How to read it

- `index.html`, `about.html` — the app itself. Open in a browser.
- `armada/REQUIREMENTS.md` — the contract the team built against: phases and
  success criteria.
- `armada/ledgers/` — process artifacts: defect, adversarial-review, and
  security-finding ledgers (`_template/` holds the format specs).
- `armada/screenshots/` — visual evidence of delivery, e.g.
  `armada/screenshots/one-piece-restaurant/about.png`.
- `AGENTS.md`, `armada.yaml`, `.opencode/` — the scaffolded team config (rules,
  manifest, agent files).
- `TODO.md` — what the voyage shipped, ticked off.

Read order that tells the whole story: `armada/REQUIREMENTS.md` (contract) →
`armada/ledgers/` (process) → `armada/screenshots/` (evidence) → the pages.

## Source provenance

Copied verbatim from `~/WBG/my-app/` — a static-landing starter that went
through an armada voyage for the One Piece restaurant feature. File contents
were not modified in this embed; only this README is new.

## Layout

```
one-piece-restaurant/
├── index.html          # landing page (menu, visit info)
├── about.html          # story + crew page
├── styles.css          # shared styles
├── landing.css         # landing-page styles
├── about.css           # about-page styles
├── script.js           # nav toggle
├── AGENTS.md           # armada build rules for the team
├── armada.yaml         # team manifest
├── .opencode/          # native agent files
├── TODO.md             # shipped items
└── armada/
    ├── REQUIREMENTS.md # the contract
    ├── ledgers/        # process ledgers (+ _template/)
    └── screenshots/    # evidence (one-piece-restaurant/about.png)
```

## Reference only

No run guarantee. Contents are a snapshot of `~/WBG/my-app` for study:
- The demo is a static site; if you want to run it, open `index.html` in a
  browser — but this embed was not install-verified.
- No `opencode.json` or `.opencode/agent/*` regeneration drift is included;
  those are armada-owned and live in the parent repo, not the demo.
