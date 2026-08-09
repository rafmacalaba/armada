# armada home page — deploy + smoke

This document covers how the static site under `web/` is built, deployed to
GitHub Pages, and locally smoke-tested. It exists alongside the actual smoke
evidence at `armada/screenshots/deploy/local-smoke.png` from the Phase 4 voyage.

## Build

```
cd web
npm ci
npm run build
```

Emits `web/dist/` with hashed asset filenames and `base: '/armada/'` so that
`web/dist/index.html` references `/armada/assets/...`. The site is a SPA:
`react-router-dom` `HashRouter` handles deep links (`/#/about`) so no custom
404 rewrite is required on GitHub Pages.

## Deploy (GitHub Pages)

GitHub Actions workflow lives at `.github/workflows/deploy.yml`. It triggers
on push to `master` and on manual `workflow_dispatch`, then:

1. `actions/checkout@v4`
2. `actions/setup-node@v4` with Node 20
3. `npm ci` in `web/`
4. `npm run build` in `web/`
5. `actions/configure-pages@v4` + `actions/upload-pages-artifact@v3` +
   `actions/deploy-pages@v4` to publish `web/dist/` to the `gh-pages` branch.

A convenience script is also available: `cd web && npm run deploy` runs
`npm run build && gh-pages -d dist` for manual one-shot deploys.

## Local smoke

The Phase 4 voyage smoke-tested the production build locally because the
worktree has no git remote. Steps:

```
cd web
npm run build
npx serve dist -p 4173 -s   # SPA fallback
```

Then Playwright (or a browser) hits:

| URL | Expected H1 | Expected status |
| --- | --- | --- |
| `http://localhost:4173/armada/` | "Multi-agent software voyages" | 200 |
| `http://localhost:4173/armada/#/docs` | "Docs" | 200 |
| `http://localhost:4173/armada/#/about` | "About armada" | 200 |

Network log confirmed zero 404s for static assets (CSS, JS, fonts).
Screenshot of both routes at 1440x900 dark theme:
`../armada/screenshots/deploy/local-smoke.png` (relative to `web/`) or
`armada/screenshots/deploy/local-smoke.png` from the repo root.

## Live deploy gap

The voyage worktree has no `origin` remote (`git remote -v` is empty), so
the live GitHub Pages deploy was not triggered. To deploy for real:

```
git remote add origin https://github.com/rafmacalaba/armada.git
git push -u origin feat/landing-page
# open a PR, merge to master
# the deploy.yml workflow will publish to https://rafmacalaba.github.io/armada/
```

After the first real deploy, replace the local smoke URLs in the table above
with the live `https://rafmacalaba.github.io/armada/` and
`https://rafmacalaba.github.io/armada/#/about` URLs.