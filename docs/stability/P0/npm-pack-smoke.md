# npm Pack Smoke Test

Pack, install, verify, and teardown of `opencode-armada` published tarball.

## Environment

- macOS (darwin), Node v23.9.0
- Working directory: sandbox/public-stability
- Temp install prefix: `/tmp/armada-p0-smoke/prefix`

## Step 1: npm pack

```
$ npm pack
npm notice
npm notice package: opencode-armada@0.9.2
npm notice Tarball Contents
...
npm notice total files: 91
npm notice
npm notice filename: opencode-armada-0.9.2.tgz
npm notice package size: 115.6 kB
npm notice unpacked size: 385.6 kB
```

Result: `opencode-armada-0.9.2.tgz` created at project root. 91 files, 115.6 kB compressed.

## Step 2: npm install (isolated prefix)

```
$ mkdir -p /tmp/armada-p0-smoke/prefix
$ npm install -g --prefix /tmp/armada-p0-smoke/prefix opencode-armada-0.9.2.tgz
added 2 packages in 307ms
```

Installed into `/tmp/armada-p0-smoke/prefix/lib/node_modules/opencode-armada`. Binary at `/tmp/armada-p0-smoke/prefix/bin/armada`. User HOME not mutated — prefix isolation confirmed.

## Step 3: Verify installed binary

### Version
```
$ /tmp/armada-p0-smoke/prefix/bin/armada --version
opencode-armada v0.9.2
(exit 0)
```

### Help
```
$ /tmp/armada-p0-smoke/prefix/bin/armada help | head -5
opencode-armada v0.9.2
Evidence-gated AI-engineer teams for opencode, natively (no plugin).

Usage:
  armada init                                interactive setup
(exit 0)
```

Binary functional. No runtime errors. Version matches `package.json`.

## Step 4: Tear down

```
$ rm -rf /tmp/armada-p0-smoke
```

Clean removal. No residual files in HOME or system paths.

## Summary

| Check | Result |
|-------|--------|
| npm pack succeeds | PASS |
| Pack contents (91 files, 115.6 kB) | PASS |
| npm install -g to isolated prefix | PASS |
| armada --version (0.9.2) | PASS |
| armada help | PASS |
| No HOME mutation | PASS |
| Teardown clean | PASS |

## Evidence checks

- [x] `npm pack` produced `opencode-armada-0.9.2.tgz` (115.6 kB, 91 files)
- [x] `npm install -g --prefix /tmp/armada-p0-smoke/prefix` succeeded (2 packages)
- [x] `/tmp/armada-p0-smoke/prefix/bin/armada --version` → `opencode-armada v0.9.2`, exit 0
- [x] `/tmp/armada-p0-smoke/prefix/bin/armada help` → full help text, exit 0
- [x] `ls /tmp/armada-p0-smoke/prefix/` shows `bin lib` only; no HOME paths affected
- [x] `rm -rf /tmp/armada-p0-smoke` clean teardown
