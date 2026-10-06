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

`simulation.test.ts` drives pieces through the public `step()` with the test-only planner in
`src/game/test-harness.ts`; the per-module files pin the pure seams directly.

| # | Behaviour | Pin (test) | Where | How it was watched red |
| ---: | --- | --- | --- | --- |
| — | the app version and `package.json` cannot disagree | `APP_VERSION matches the version in package.json` | `src/version.test.ts` | bump `APP_VERSION` in `src/version.ts` alone → RED (landing 63a1500) |
| 1 | a blocked rotation is refused — position AND orientation survive | `a blocked rotation is refused: the piece keeps its position AND its orientation` | `src/game/simulation.test.ts` | arm 1: add a one-cell upward kick (`simulation.ts` `8cb24aab54bdf534` → `82f28184ddfd9d00`) → RED, exit 1 |
| 2 | LFSR seeded `0x8988` produces Vector A | `steps 0x8988 into Vector A: the spec's first 16 values` | `src/game/lfsr.test.ts` | arm 2: LFSR tap `>> 9` → `>> 10` (`lfsr.ts` `9ac9894154bbfc54` → `90f5fcfacc4027ae`) → RED, exit 1 |
| 3 | the picker is pure: `(seed, spawnCount, spawnID)` → Vector B, no frames between calls | `is a pure function of (seed, spawnCount, spawnID) and reproduces Vector B with no frame steps` | `src/game/randomiser.test.ts` | arm 2 (same mutation shifts every pick) → RED |
| 4 | the simulation steps the LFSR exactly once per frame | `steps the LFSR exactly once per frame, whatever the input or phase` | `src/game/simulation.test.ts` | arm 2 → RED (the stepping rate is what the value pins) |
| 5 | the integration produces Vector D under the documented 48-frame cadence | `reproduces Vector D: LFSR + picker under the 48-frame cadence (dispatcher model, not ROM truth)` | `src/game/simulation.test.ts` | arm 2 → RED |
| 6 | gravity is the table, clamped to 1 frame/cell at level 29+ | `is the 30-entry NTSC frames-per-cell table, clamped to 1 at level 29 and above` + `drops one cell per frame at level 29 and one cell per 48 frames at level 0` | `src/game/gravity.test.ts`, `src/game/simulation.test.ts` | arm 3: clamp returns 2 (`gravity.ts` `2b1bfc9b0d165807` → `93760edd77151ede`) → RED on both, exit 1 |
| 7 | a piece locks only when a drop tick fails; moving/rotating in the resting window does not extend it | `locks only when a drop tick fails, and moving during the resting window does not extend it` + `locks on the failing tick even when a rotation is attempted in the resting window` | `src/game/simulation.test.ts` | arm 1 (the kick moves the piece during the window) → RED |
| 8 | game over iff a locked piece was invalid; an overlapping spawn is not a loss | `ends only when a piece LOCKS invalid; an overlapping spawn is not itself a loss` | `src/game/simulation.test.ts` | not injected — see "not yet watched red" below |
| 9 | cells in the two hidden rows are not stored at lock | `stores the visible cells of a locked piece and drops the hidden-row ones` | `src/game/simulation.test.ts` | arm 2 → RED (a different piece sequence reaches no hidden-row lock) |
| 10 | scoring uses the level AFTER the clear | `scores every lock at the level AFTER the clear, including the one that levels up` | `src/game/simulation.test.ts` | not injected — see below |
| 11 | DAS is 16 then 6; a blocked shift resets the counter to 16; the counter survives ARE and release | `is 16 then 6, a blocked shift resets the counter to 16, and the counter survives ARE and release` | `src/game/simulation.test.ts` | arm 4: `DAS_RESET_FRAMES` 16 → 15 (`das.ts` `5766569f48d15956` → `e5d46ca71d0707d6`) → RED, exit 1 |
| 12 | horizontal shift is refused while Down is held | `refuses the horizontal shift — tap and auto-shift alike — while Down is held` | `src/game/simulation.test.ts` | not injected — see below |
| 13 | the preview matches what spawns | `always spawns exactly the piece the preview showed` | `src/game/simulation.test.ts` | not injected — see below |

### Not yet watched red (recorded, not hidden)

The brief asked for a differential on pins **1, 2, 6 and 11**; those four were injected and
are the arms below. Pins 3, 4, 5, 7 and 9 were also watched red **incidentally** by the same
four arms (the mutation each broke a shared seam). Pins **8, 10, 12 and 13** have NOT been
watched red yet — they are green and their statements are specific, but no injected arm has
proved them discriminating. A successor should inject:

- pin 8 — validate the piece at SPAWN (a one-line `if (!isPositionValid(...)) gameOver` in
  `spawnNext`) → the overlap assertions must fail;
- pin 10 — run the level-up check AFTER `lockBaseScore` is added;
- pin 12 — drop the `if (held.down) return;` guard in `handleInput`;
- pin 13 — re-`pick()` at spawn instead of consuming `nextId`.

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

### simulation-core — the pure simulation (ledger row 5)

- **Gate (this worktree, full tier, in-turn, foreground):** exit `0` on the pre-rebase tree —
  cheap tier `tsc --noEmit && vite build` GREEN, `6 modules transformed`, built in **53ms**; full
  tier **45/45 tests passed** in 7 files, 639ms. **Re-gated after the rebase onto origin/main
  `4f6b7e2`** (the rebase hit a docs-only conflict in `docs/BOARD.md`, resolved as a union): exit
  `0` again, build **48ms**, **45/45** in 635ms. After the docs-only amend, the **cheap tier exited
  `2`** — a documentation edit cannot change a typecheck or a build, and the cheap tier takes no
  lock. Raw log `/home/administrator/projects/Tetris/.gate-logs/gate.log` (the gate writes to the
  SHARED git-common-dir, so every worktree overwrites the same file); every run was made with
  `cwd = worktrees/simulation-core`, which is the tree the gate's commands execute in — the suite
  banner `RUN v5.0.3 /home/administrator/projects/Tetris/worktrees/simulation-core` is the proof.
- **Docs conflict (union):** the dispatcher landed `4f6b7e2` (board: in-flight row for this slice)
  while this landing was in flight. `git diff --name-only origin/main` after the resolution lists
  ONLY this landing's files (the four docs it amends plus `src/game/**`); the dispatcher's board
  lines were taken verbatim, its IN-FLIGHT row's `state=RUNNING` was changed to `state=LANDED` (its
  own slice — the truth changed), and my LANDED row was inserted below it.
- **Differential** (script `.gate-logs/scratch/differential.sh`, mutated file hashes are
  md5 prefixes, all four arms restored from a copy under `.gate-logs/scratch/pristine/`,
  never `git checkout`; the pristine copy lives outside the tracked tree and the restore is
  in a `trap`). Each arm: take the gate lock → inject → print the hash → release the lock →
  run THE gate → restore → re-print the hash. Between the release and the gate's own `mkdir`
  there is a sub-millisecond window; the writer is the only writer in flight, and the
  post-arm hash check is what proves the tree was left clean:

  | Arm | File | Baseline hash | Mutated hash | Gate exit | Pin that went RED |
  | --- | --- | --- | --- | ---: | --- |
  | 1 | `src/game/simulation.ts` | `8cb24aab54bdf534` | `82f28184ddfd9d00` | 1 | pin 1 `rotation > a blocked rotation is refused…` (`expected 17 to be 18`) and pin 7 `lock behaviour > locks on the failing tick even when a rotation is attempted…`; `2 failed | 43 passed` |
  | 2 | `src/game/lfsr.ts` | `9ac9894154bbfc54` | `90f5fcfacc4027ae` | 1 | pin 2 `lfsr.test.ts > steps 0x8988 into Vector A…`, plus pins 3, 5 and 9 incidentally; `4 failed | 41 passed` |
  | 3 | `src/game/gravity.ts` | `2b1bfc9b0d165807` | `93760edd77151ede` | 1 | pin 6, both halves (`expected 2 to be 1`); `2 failed | 43 passed` |
  | 4 | `src/game/das.ts` | `5766569f48d15956` | `e5d46ca71d0707d6` | 1 | pin 11 `DAS > is 16 then 6, a blocked shift resets the counter to 16…` (`expected 3 to be 4`); `1 failed | 44 passed` |

  Post-arm hashes were identical to the baseline for all four files; `git status --porcelain`
  shows only this slice's untracked `src/game/` and the four docs amended in this landing —
  i.e. no source file was left mutated. Arm logs: `.gate-logs/scratch/arm{1,2,3,4}-*.log`
  plus the console transcripts `.gate-logs/scratch/arm{1,2,3,4}-*.gate.txt`.
- **Two arms with identical output would be a VOID probe.** They are not: each arm has a
  distinct mutated hash and each cites a different pin name and a different assertion.
- **VOID:** none.

### fa0001d — the DISPATCHER's independent verification (ledger row 5)

The author's gate proves the change does what the author *meant*; only an independent arm proves
the pins hold the property. Run by the dispatcher on the INTEGRATED tree after the landing, with
no other writer in flight.

- **The dispatcher's own gate** (main tree at `fa0001d`, full tier): exit `0` · **45/45** in 7
  files · 599ms · raw log `.gate-logs/gate.log`. It matches the author's **45/45** exactly, which
  is the point of running it.
- **The author honestly listed pins 8, 10, 12 and 13 as never watched red.** The dispatcher chose
  those for its own arms. Checking the author's arm list against the pin list also showed **pin 4**
  covered by no arm at all, so it was added. Script
  `.gate-logs/dispatcher-differential.sh`; baseline `src/game/simulation.ts` sha256[0:16]
  `6f53e1cd4d2fb51b`, restored from an out-of-tree copy in a `trap`:

  | Arm | Target pin | Mutated hash | Gate exit | Pin that went RED |
  | --- | --- | --- | ---: | --- |
  | 4 | per-frame LFSR stepping | `bf6a06e0783b6d8d` | 1 | `the LFSR seam inside the stepper > steps the LFSR exactly once per frame, whatever the input or phase` (+ Vector D, + hidden rows); `3 failed \| 42 passed` |
  | 8 | top-out | `f0ef6fb8299087a7` | 1 | `top-out > ends only when a piece LOCKS invalid; an overlapping spawn is not itself a loss`; `1 failed \| 44 passed` |
  | 10 | scoring at the post-clear level | `4dd1a946c14a38bb` | 1 | `scoring > scores every lock at the level AFTER the clear, including the one that levels up`; `1 failed \| 44 passed` |
  | 12 | no shift while Down is held | `1a14c27f26a14ba8` | 1 | `soft drop gating > refuses the horizontal shift — tap and auto-shift alike — while Down is held` (+ released); `2 failed \| 43 passed` |
  | 13 | preview matches spawn | `dea08147f221262d` | 1 | `the preview > always spawns exactly the piece the preview showed` (+ hidden rows); `2 failed \| 43 passed` |

  Restore verified: hash back to `6f53e1cd4d2fb51b`, `git status` clean. Five distinct mutated
  hashes = five real probes. **Every pin in the matrix has now been watched red**, by the author
  (1,2,3,5,6,7,9,11) or by the dispatcher (4,8,10,12,13).
- **VOID (the dispatcher's own, recorded not hidden):** the FIRST arm-13 injection replaced the
  spawn's `id` with `rolled.id`, leaving `id` unread. `noUnusedLocals` made `tsc` fail the cheap
  tier (`error TS6133: 'id' is declared but its value is never read`) so the gate exited `1`
  **with no failing test** — an exit code that looked like a red pin and was a compile error. That
  arm never exercised pin 13 and proved nothing. Log kept as
  `.gate-logs/dispatcher-arms/arm-13-VOID.log`; re-injected as a two-line swap so both bindings
  stay used, which reddened the pin properly. **A non-zero exit is not evidence until the failing
  test's NAME is read.**
- **The dispatcher reproduced the author's spec correction independently:** 4,936 consecutive
  same-piece repeats in 200,000 picks, so `docs/NES-MECHANICS.md` §2's invariant claim was wrong
  and has been corrected.
- **Retired:** worktree `worktrees/simulation-core` removed, branch `slice/simulation-core` deleted
  (it was never pushed — only `main` is on the remote), author session deleted. Salvage-checked
  first: the worktree was clean and its HEAD `fa0001d` was already an ancestor of `origin/main`.

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

### This landing's honest records

- **A green run of the WRONG TREE was possible and was avoided.** The gate derives its log
  and lock from the git COMMON dir (always the main repo) but runs its commands in the
  caller's cwd. Every gate call here was made with `cwd = worktrees/simulation-core`; the
  suite output line `RUN v5.0.3 /home/administrator/projects/Tetris/worktrees/simulation-core`
  is the proof that the worktree, not the main tree, was under test.
- **The test harness had a real bug that the first probes caught.** A non-standard
  `wellSums` (counting upward from each well cell) made the planner build a tower in the
  middle of the board. Fixed to the standard cumulative-depth form before anything was
  pinned; without that the scoring pin could not have reached level 1. The planner is
  test-only, so this was a fixture bug, not a simulation bug.
- **Two tests were corrected because the SPEC, not the code, was wrong.** (a) `stepLfsr(0x0001)`
  is `0x0000`, not `0x8000` — the test's second expectation was wrong. (b) §2's claim that the
  repeat check makes it "effectively not the same piece twice in a row" is an approximation:
  the re-roll index `(((seed >> 8) & 7) + spawnID) % 7` can land on the previous piece. The
  test now asserts the approximation is violated rather than pretending it holds.
