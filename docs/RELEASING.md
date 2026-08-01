# Releasing opencode-armada

How to cut a release: publish to npm + tag a GitHub release. Two parts, both keyed off a git
tag `vX.Y.Z`.

## What a release is

| Artifact | How | Trigger |
|---|---|---|
| npm package `opencode-armada@X.Y.Z` | `npm publish` (workflow or manual) | tag push |
| GitHub release `vX.Y.Z` | `.github/workflows/release.yml` `release` job | tag push |

`.github/workflows/release.yml` runs on any `v*` tag: **test** → **publish** (npm, skipped when
`NPM_TOKEN` secret is absent) → **release** (GitHub, always). Branch protection on `master`
means every code change — including the version bump — lands via a PR.

## Prerequisites

- On `master`, working tree clean, tests green: `node --test 'tests/*.test.js'`
- npm credentials (one of the two paths below)
- Versions live in **two places** — keep them in sync:
  - `package.json` → `"version": "X.Y.Z"`
  - `src/cli.js` → `export const VERSION = "X.Y.Z"`

## The version bump (both paths)

1. Bump `package.json` `version` **and** `src/cli.js` `VERSION` to the same value.
2. Branch → PR → merge (`chore: release vX.Y.Z`).
3. Make sure `master` is up to date: `git pull`.

## Path A — automated (recommended once `NPM_TOKEN` is set)

Requires an **Automation-type granular access token** stored as repo secret `NPM_TOKEN`
(Settings → Secrets → Actions). Automation tokens bypass the npm 2FA prompt, which a plain
token cannot.

```bash
git tag v0.3.0 && git push origin v0.3.0
```

That's it. The workflow: tests (must pass) → `npm publish --access public` → GitHub release
with auto-generated notes. Verify:

```bash
npm view opencode-armada version      # expect X.Y.Z
gh run list --workflow=release.yml --limit 1   # expect completed/success
```

## Path B — manual (no `NPM_TOKEN`)

1. Bump version + PR + merge (as above).
2. Publish from the repo root:

   ```bash
   npm publish --access public
   ```

   npm requires a one-time password. **The npm CLI cannot use a WebAuthn security key** — you
   need a TOTP authenticator app code, or publish via the npm web UI.
3. Create the GitHub release (tag push also runs the workflow — its npm step skips, the GitHub
   release job may race you; creating it explicitly is fine):

   ```bash
   gh release create v0.3.0 --title "opencode-armada v0.3.0" --notes "…"
   ```

4. Verify: `npm view opencode-armada version` and
   `gh release view v0.3.0`.

## Gotchas learned the hard way

- **npm 2FA is enforced on publish even with a token** — `EOTP`. Only an *Automation* granular
  token skips it. A plain token still prompts for an OTP the CLI can't produce for a security key.
- **`secrets` is not usable in `if` conditions** (job or step level) in GitHub Actions. The
  workflow gates the npm step on `env.NODE_AUTH_TOKEN != ''` instead.
- **The GitHub release job needs a tag.** A manual `workflow_dispatch` run on `master` (no tag)
  fails at the release step with "GitHub Releases requires a tag" — that's expected, not a bug.
- **Version drift** between `package.json` and `src/cli.js` breaks `armada help` output vs npm
  metadata. Bump both.
- **Branch protection**: never push straight to `master`; every bump and doc change is a PR.
