# armada web — home + about + docs

Vite + React + TypeScript, HashRouter, two themes persisted in
`localStorage` under `armada-theme`.

## Develop

```
npm install
npm run dev      # http://127.0.0.1:5173
npm run build
npm run preview
npm run typecheck
npm run lint
```

## Routes

- `/` — Home
- `/docs` — Docs (curated index of the docs/*.md guides, links to GitHub)
- `/about` — About
- anything else — 404 fallback