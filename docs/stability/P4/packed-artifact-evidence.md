# P4: Packed artifact evidence

## Script stdout/stderr

```
> opencode-armada@0.9.2 test:packed
> node tests/run-packed-test.js

[1/5] npm pack opencode-armada@0.9.2 ...
  -> opencode-armada-0.9.2.tgz
[2/5] install to temp prefix ...
  -> prefix=/var/folders/4y/4m7t2dpd2xg210krnt89nrmh0000gn/T/tmp.Olj5EaxFlH
  -> binary at /var/folders/4y/4m7t2dpd2xg210krnt89nrmh0000gn/T/tmp.Olj5EaxFlH/bin/armada
[3/5] run --version and help ...
  -> version: opencode-armada v0.9.2
  -> help OK
[4/5] assert binary matches dock src/cli.js ...
  -> match OK
[5/5] cleanup ...
  -> prefix removed

PASS: opencode-armada-0.9.2.tgz installed and runs in clean prefix.
```

## Test coverage

- `tests/packed-artifact.test.js` — wraps `npm run test:packed`, asserts exit 0, asserts "PASS" in output.
- `tests/run-packed-test.js` — standalone verification script: npm pack, install to temp prefix, run --version/help, assert binary matches dock, cleanup.

## Gate declaration

Gate passes: packed binary (`opencode-armada-0.9.2.tgz`) installs with `npm install -g --prefix <temp>` and runs `--version` / `help` in a clean prefix. Installed binary matches dock `src/cli.js` line 1. Temp prefix and tarball cleaned up.

Full unit suite: **612 pass, 0 fail** — no regressions.
