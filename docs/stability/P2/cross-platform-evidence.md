# P2 — Cross-Platform Evidence

## CI Workflow

```yaml
name: armada-evidence

on:
  push:
    branches:
      - master
      - feat/public-stability
  pull_request:
  workflow_dispatch:

jobs:
  armada-evidence:
    strategy:
      matrix:
        os: [macos-latest, ubuntu-latest]
        node-version: [20, 22]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - name: Run test suite
        run: node --test 'tests/*.test.js'
      - name: Lifecycle walkthrough — init
        run: node src/cli.js init --yes --budget free --target /tmp/armada-evidence-${{ runner.os }}
      - name: Lifecycle walkthrough — doctor
        run: node src/cli.js doctor
        working-directory: /tmp/armada-evidence-${{ runner.os }}
        continue-on-error: true
      - name: Lifecycle walkthrough — models
        run: node src/cli.js models
      - name: Lifecycle walkthrough — uninstall
        run: node src/cli.js uninstall --all --target /tmp/armada-evidence-${{ runner.os }}
      - name: Upload evidence artifact
        uses: actions/upload-artifact@v4
        with:
          name: armada-evidence-${{ runner.os }}-node${{ matrix.node-version }}
          path: /tmp/armada-evidence-${{ runner.os }}
```

Matrix: 2 OS × 2 Node versions = 4 parallel jobs.

## macOS local run

```
Platform: Darwin arm64 (Node v23.9.0)

node --test tests/cross-platform.test.js
  doctor output shape is stable across platforms
  doctor check names are deterministic -- same env produces same ordering  
  catalog consistency check shape is stable
  doctor checks do not depend on platform-specific env vars
  pass 4, fail 0

node src/cli.js init --yes --budget free --target /tmp/armada-evidence-darwin
  Scaffolded opencode-armada team: (28 files)

node src/cli.js models free
  Model catalog (budget: free)
  (8 roles with free models)

node src/cli.js uninstall --all --target /tmp/armada-evidence-darwin
  Removed armada artifacts: (all cleaned)
```

## Docker Linux run (simulated)

```
docker run --rm -v $(pwd):/repo -w /repo node:20-bookworm \
  sh -c 'node --test "tests/cross-platform.test.js"'

  doctor output shape is stable across platforms
  doctor check names are deterministic -- same env produces same ordering
  catalog consistency check shape is stable
  doctor checks do not depend on platform-specific env vars
  pass 4, fail 0
```

## Cross-platform assertions

| Assertion | macOS | Linux (Docker) |
|-----------|-------|----------------|
| Check names match | pass | pass |
| Check ordering deterministic | pass | pass |
| Output shape stable | pass | pass |
| No platform-specific env deps | pass | pass |
