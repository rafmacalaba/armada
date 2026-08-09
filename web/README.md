# armada web — landing + about

Phase 1 foundation. Vite + React + TypeScript, HashRouter, two themes
persisted in `localStorage` under `armada-theme`.

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

- `/`         — Landing (Phase 2 will add real content)
- `/about`    — About  (Phase 3 will add real content)
- anything else — 404 fallback

Phase 4 will switch `vite.config.ts` `base` to `/armada/` and add a
`deploy` script that pushes `dist/` to `gh-pages`.
