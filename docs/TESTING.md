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

### 63a1500 — bootstrap

- **Gate:** cheap tier exit `2` (build green, suite deliberately NOT run) · full tier exit
  `0` · `1/1` tests · vite build 58ms · raw log `.gate-logs/gate.log`, archived as
  `.gate-logs/landing-63a1500.log` (the gate overwrites its log, so a quoted landing's log is
  copied aside before the next run)
- **Differential:** arm A `4f0fd4092437bea2` (baseline `src/version.ts`, committed) · arm B
  `edf3ec532ba1bbda` (`APP_VERSION` → `9.9.9`) → full gate exit `1`, RED on
  `src/version.test.ts > APP_VERSION > matches the version in package.json`
  (`AssertionError: expected '9.9.9' to be '0.0.1'`). Raw log `.gate-logs/diff-armB.log`.
  Restore verified: hash back to `4f0fd4092437bea2`, `git status` clean.
- **What the differential proved about the tiers:** the cheap tier stayed **GREEN** on arm B
  — a version drift typechecks and builds. Only the full tier catches it. The cheap tier is
  a *deploy* guard, never a correctness guard.
- **VOID:** none

## Deploy verification (what proves a publish)

A publish is proven by **CONTENT**, never by a status code — an old build answers `200` too.
`bash scripts/publish.sh` performs all of it and exits non-zero if any step fails, so a
half-finished publish cannot look done:

1. the built `dist/index.html` references `/<slug>/assets/…` — a root-absolute build renders a
   **blank page** under a subpath, and nothing downstream catches that;
2. the local origin (which bypasses the CDN) serves the **same hashed asset** this build just
   wrote, and that asset is fetchable;
3. the public URL answers `200` with `cf-cache-status: DYNAMIC` — a `HIT` on an unchanged
   filename would mean OLD bytes are being served;
4. the hub is rebuilt, its **served** asset hashes equal the built ones, and the live
   `apps.index.json` lists the app.

### 170e34a — first publish (ledger row 4)

- **App:** built `assets/index-C_yU7wtq.js` · local origin `200`, same hash · public
  `https://apps.futuremagic.de/Tetris/` `200`, `cf-cache-status: DYNAMIC`, asset `200`
- **Hub:** served `index-DKg0JsrY.js` + `index--fd800dr.css`, identical to the built `dist` ·
  live index = 18 apps, Tetris present
- **What was actually live:** the shell — it renders `Tetris 0.0.1`. Recorded, not smoothed over.

## Honest records

A VOID probe, a wrong-file green, a discarded log and a verification run against a stale
tree are all **recorded, not hidden**.
