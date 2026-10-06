# Testing — what proves this, and what was actually run

This doc exists because **"it compiles" is never "it passed"**, and because a green result
whose evidence was discarded cannot be diagnosed. It records the pins, the differential arms
with their hashes, and the VOID probes — per landing, as they were actually run.

The full contract is the Toolbox `docs/TESTING.md`.

## The pin

A **pin** is a test that goes red when the behaviour it protects is broken.

1. **A test's NAME is part of the deliverable** — a pin that reds must say what it protects.
2. **A pin must be watched red at least once** (the differential below).
3. **Reuse the existing harness.** A second fixture set for the same idea is duplication.

## The pin matrix

| Behaviour | Pin (test) | Where | How it is watched red |
| --- | --- | --- | --- |
| the app version and `package.json` cannot disagree | `APP_VERSION matches the version in package.json` | `src/version.test.ts` | bump `APP_VERSION` in `src/version.ts` alone → RED |

## Raw logs

The gate writes to `.gate-logs/gate.log`. The raw log is kept until the landing is verified.
Never pipe a run through `tail`/`head`.

## Per landing

### `<pending first commit>` — bootstrap

- **Gate:** cheap tier exit `2` · full tier exit `0` · `1/1` tests · raw log
  `.gate-logs/gate.log`
- **Differential:** arm A (baseline) = committed tree · arm B = `src/version.ts` bumped to
  an unmatching version → RED on `APP_VERSION matches the version in package.json`
- **VOID:** none

## Honest records

A VOID probe, a wrong-file green, a discarded log and a verification run against a stale
tree are all **recorded, not hidden**.
