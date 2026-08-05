# P2 — Opencode Version Evidence

## Declared version range

- Minimum: `>= 1.18.0`
- Source: `src/doctor.js:7` — `export const MIN_OPENCODE = "1.18.0"`
- Peer dependency: `package.json:50` — `"opencode": "^1.18.0"`
- CI tested: Node 20 + 22 on macOS + Linux

## Version check implementation

`src/doctor.js:45-82` — `parseOpenCodeVersion()` and `checkOpenCodeVersion()`

```js
export function parseOpenCodeVersion(output) {
  const m = output.match(/(\d+\.\d+\.\d+)/)
  return m ? m[1] : null
}

export function checkOpenCodeVersion(versionOrOutput, minVersion = "1.18.0") {
  const parsed = parseOpenCodeVersion(versionOrOutput)
  if (!parsed) return { status: "fail", detail: "unrecognized version format..." }
  // Compare each semver component
  const parts = parsed.split(".").map(Number)
  const minParts = minVersion.split(".").map(Number)
  for (let i = 0; i < 3; i++) {
    if (parts[i] > minParts[i]) break
    if (parts[i] < minParts[i])
      return { status: "fail", detail: `${parsed} is below minimum..."` }
  }
  return { status: "pass", detail: `${parsed} — within supported range..."` }
}
```

## Test results

```
node --test tests/opencode-version-range.test.js

  parseOpenCodeVersion extracts version from standard output
  parseOpenCodeVersion returns null for unparseable output
  checkOpenCodeVersion passes for supported version
  checkOpenCodeVersion passes for newer version
  checkOpenCodeVersion passes for version higher than minimum
  checkOpenCodeVersion fails for older version
  checkOpenCodeVersion fails for much older version
  checkOpenCodeVersion fails for unparseable output
  checkOpenCodeVersion fails for null/empty output
  checkOpenCodeVersion fails when version missing from output
  checkOpenCodeVersion handles custom minimum
  pass 11, fail 0
```

## Doctor integration

```
node --test tests/doctor.test.js

  opencode version range passes on supported version (1.18.11)
  opencode version range fails on unsupported version (1.17.0)
  opencode version range fails when opencode returns unparseable output
  opencode version range passes on version equal to minimum (1.18.0)
  opencode version range passes on newer major version (2.1.0)
```

## Node runtime check

`src/cli.js:20-33` — `checkNodeRuntime()` blocks Node < 20 before any imports.

```
node --test tests/node-engines.test.js

  checkNodeRuntime returns null for Node >= 20
  checkNodeRuntime returns null for Node 22
  checkNodeRuntime returns null for Node 23
  checkNodeRuntime returns error string for Node 18
  checkNodeRuntime returns error string for Node 16
  checkNodeRuntime returns error string for Node 0.12
  checkNodeRuntime handles unexpected version format gracefully
  CLI help exits 0 on supported Node (no runtime error)
  pass 8, fail 0
```

Error message format: `Unsupported runtime: Node.js >= 20 required (detected v18.20.0). Upgrade to Node 20 or later and retry.`

## Compatibility matrix

| Node | Opencode | macOS | Linux | Status |
|------|----------|-------|-------|--------|
| 20.x | 1.18.0+ | CI | CI | Supported |
| 22.x | 1.18.0+ | CI | CI | Supported |
| 23.x | 1.18.0+ | Local | via Docker | Supported |
| <20 | any | — | — | Blocked at CLI entry |
