# Contributing to {project_name}

Thanks for contributing!

## Getting started

1. `npm install`
2. `npm run dev` to develop locally.

## Tests

- Run `npm run test` before opening a PR.
- Add a test for every pure function in `src/lib/`.

## Pull request checklist

- [ ] `npm run test` green
- [ ] `npm run build` green
- [ ] No secrets committed (`*.env`, `*.env.local`)
- [ ] Description explains what and why

## Conventions

- TypeScript strict.
- Pure logic in `src/lib/`, thin pages in `src/app/`.
