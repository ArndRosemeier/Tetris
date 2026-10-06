# The board — what is happening right now

**This file is the state of record.** It is true *before* any report reaches the owner. A
successor session must be able to act within minutes from this file plus
`git log --oneline -10 origin/main` and `git worktree list`.

**One screen, overwritten in place.** A record that no longer describes the present belongs
in the decision ledger or nowhere.

## The contract

1. **Updated in the same commit as the landing it records.**
2. **True BEFORE the dispatcher reports to the owner.**
3. **Every record names something checkable** — sha, branch, worktree, session id, path.
4. **Session start = reconcile first** (`bash scripts/board.sh`). Read it, check it against
   reality, fix what lied, report ONE line, and only then dispatch.
5. **Reconcile against the REMOTE branch, never a stale local one.**

Record vocabulary (`PREFIX | field=value | …`) is defined in the Toolbox
`docs/BOARD.md`. Only the literal key `retired_branch=<name>` is read as a retirement
claim — never use that key for prose about a retirement that is still owed.

---

## Board

```
reconciled: 170e34a · 2026-10-06T13:41Z

SESSION | id=session-76777914-6dab-4bba-975f-d4444ae0ed6d | model=deepseek/deepseek-flash | role=chief-of-staff | state=waiting

PROBE | id=b496443b-2efb-44af-8cbe-3d0574bf9953 | state=CONSUMED 2026-10-06 and DELETED |
  q="the exact NES Tetris mechanics" | answer=docs/NES-MECHANICS.md — sourced, confidence-tagged
  [V]/[W]/[I], with reference vectors regenerated INDEPENDENTLY by the dispatcher

DIVERGENCE | deliberate, bounded, and listed in docs/NES-MECHANICS.md §12 so a successor does
  not read them as oversights: the packed-BCD soft-drop scoring bug, the top-row 256-cell clear
  bug, hidden-row collision indexing wraps, high-level display glitches, the ~level-155 crash,
  and PAL timings are NOT reproduced. Score is a plain integer; NTSC only.

LANDED | row=1 | sha=63a15003cf0bb2f5785c09421ea5065305b7c168 | verify=MY OWN: cheap tier
  green (exit 2) + full gate GREEN (exit 0) · 1/1 tests · vite build 58ms · raw log
  .gate-logs/gate.log | arms=4f0fd4092437bea2 (baseline) vs edf3ec532ba1bbda (injected
  APP_VERSION) — arm B RED on the pin `APP_VERSION matches the version in package.json`,
  exit 1; restore verified, tree clean | retired: nothing (no writers dispatched yet) |
  docs=board, ledger row 1, testing per-landing 63a1500 | note=bootstrap only; no game
  code exists yet

INFRA | remote=https://github.com/ArndRosemeier/Tetris.git | created=2026-10-06 by the
  dispatcher via the GitHub API (http 201) | visibility=public, matching all six sibling
  repos | push=HEAD 1d0da4023979c2a3a669da8bc0ebaa27b22012ee == origin/main, verified

LANDED | row=4 | sha=170e34ad7b863baaedbf1c41067a0f23ce469574 | verify=MY OWN: `publish.sh`
  exit 0 · built entry references /Tetris/assets/index-C_yU7wtq.js · `~/apps/Tetris` -> `dist`
  symlink · local origin HTTP 200 serving the SAME hash, asset 200 · public
  https://apps.futuremagic.de/Tetris/ HTTP/2 200 with cf-cache-status=DYNAMIC, asset 200 · hub
  rebuilt: SERVED index-DKg0JsrY.js + index--fd800dr.css identical to the built dist, live
  apps.index.json = 18 apps including Tetris · gate: full tier exit 0 | docs=board, ledger row 4,
  testing §deploy | note=THE LIVE PAGE IS THE SHELL — it renders "Tetris 0.0.1". The hub card is
  honest about that ("In progress.")

IN-FLIGHT | ledger=5 | session=4f1d84a5-e489-4882-8d17-6c614fc06701 | worktree=/home/administrator/projects/Tetris/worktrees/simulation-core
  | branch=slice/simulation-core | base=8bab1c5e6830b37b0ecd13e14d80812c753f3450 | state=LANDED 2026-10-06 — see LANDED row=5 below
  | scope=THE PURE SIMULATION under `src/game/` — the 19 orientations and refused-in-place
  rotation, the LFSR + spawn-count randomiser, the 10x22 board with 2 hidden rows, the gravity
  table, soft drop, lock-on-failed-drop, line clear with hidden-row truncation, lock-time-overlap
  top-out, post-clear-level scoring, the first-level-up table, DAS 16/6, spawn/ARE timing, and the
  one-piece accurate preview. 13 named pins; dispatcher design decision Vector D. Nothing renders.
  | cadence=SILENCE until LANDED or BLOCKED; a clean tree with no new commit is normal

LANDED | row=5 | sha=this commit carries this row (`git log -1 --format=%H origin/main`) |
  branch=slice/simulation-core | worktree=worktrees/simulation-core | session=4f1d84a5-e489-4882-8d17-6c614fc06701 |
  verify=MY OWN, in-turn foreground from the worktree: full gate exit 0 twice — pre-rebase run
  (build 53ms, 45/45 in 639ms) and the re-gate on the REBASED tree 4f6b7e2 (build 48ms, 45/45 in
  635ms); after the docs-only conflict-resolution amend, cheap tier exit 2 (docs change the
  typecheck/build not at all, and the cheap tier takes no lock) · raw log .gate-logs/gate.log (the
  gate writes to the SHARED git-common-dir, so every worktree overwrites the same file) | arms=4 arms, each injected then
  restored from an out-of-tree copy inside a trap: (1) simulation.ts 8cb24aab54bdf534 ->
  82f28184ddfd9d00 RED pin 1 (+ pin 7), (2) lfsr.ts 9ac9894154bbfc54 -> 90f5fcfacc4027ae RED pin 2
  (+ pins 3, 5, 9), (3) gravity.ts 2b1bfc9b0d165807 -> 93760edd77151ede RED pin 6 (both halves),
  (4) das.ts 5766569f48d15956 -> e5d46ca71d0707d6 RED pin 11; every arm exit 1, post-arm hashes
  identical to baseline | docs=architecture (real seam rows + the SimulationState shape), ledger
  row 5, testing (full pin matrix + arm hashes), board | COPIES: 1 — checked, no duplication
  (grepped: the 19 orientations, the LFSR recurrence, spawnTable, the gravity table, the DAS
  constants and the `[W]` delays each appear in exactly one module under src/game/) | note=THE
  SIMULATION ONLY — nothing renders; src/main.ts still writes a version string. Pins 8, 10, 12,
  13 are green but have NOT been watched red.

QUEUE | ledger=2 CLOSED — the ruleset decision is in force and is being implemented by the
  in-flight slice above
QUEUE | row=6 | Remove "In progress." from `public/futuremagic.json` and give the card a
  screenshot, once a playable slice exists — the public card must not carry a stale caveat | src=public/futuremagic.json
QUEUE-CLOSED | row=3 — the remote now exists; see INFRA · row=4 — PUBLISHED; see LANDED

RECOVERY | repo=/home/administrator/projects/Tetris |
  remote=https://github.com/ArndRosemeier/Tetris.git | branch=main | gate=bash scripts/gate.sh
  | publish=bash scripts/publish.sh | live=https://apps.futuremagic.de/Tetris/ (symlink from
  ~/apps/Tetris to dist/, so every rebuild goes live) | mechanics=docs/NES-MECHANICS.md
  | logs=.gate-logs/ | process=~/projects/Toolbox/docs/WAY-OF-WORKING.md
  | sessions=~/.dsh/sessions/--home-administrator-projects-Tetris--
```

## Guards

- **`GUARD` — the suite lock, and it is ONE lock across worktrees.** `scripts/gate.sh` takes
  an atomic `mkdir` lock at `.gate-lock/` derived from the git common dir. **VERIFIED
  2026-10-06** with the lock held by a live process: a full gate run **from a worktree**
  exited `9` (REFUSED, VOID); with the lock free the same run from the worktree was GREEN and
  printed `repo: /home/administrator/projects/Tetris`. Verify it the same way.
- **`GUARD` — the cheap tier cannot pass as a full gate.** `GATE_TESTS=0` exits 2, never 0.
  **VERIFIED 2026-10-06** (exit 2 on the bootstrap tree). Verify:
  `GATE_TESTS=0 bash scripts/gate.sh; echo $?` prints 2.
- **`GUARD` — a writer's worktree is disposable.** **VERIFIED 2026-10-06**:
  `git worktree add` → gate → `git worktree remove` + `git branch -D` left the main tree
  clean, the lock free, and no stray process.
- **`GUARD` — the CDN does not edge-cache the HTML, so a publish goes live at once.**
  **MEASURED 2026-10-06** on the first publish: `https://apps.futuremagic.de/Tetris/` and the
  hub root both answered `cf-cache-status: DYNAMIC`. The four-hour staleness the apps-publish
  skill warns about therefore does NOT bite an entry page here (and the assets are
  content-hashed anyway) — but the warning still governs any fixed-name file, e.g. a service
  worker. RE-MEASURE after any change to the host or the CDN setup; do not inherit this.

## Traps (each with the rule that prevents it)

- `TRAP` — a fresh project's board cannot be reconciled at all: with no `origin`, the
  reconciler exits `CANNOT LOOK` rather than reporting a pass. Rule: a check that cannot
  look must never be read as green; create the remote before trusting board.sh.
- `TRAP` — a copied `scripts/gate.sh` keeps the **source project's** commands as its
  defaults: it ran `npm run typecheck` / `npm test` against a pnpm project. Measured
  2026-10-06, bootstrap. Rule: after copying the scaffold, set both tier commands **and run
  both tiers** before trusting the copy — a gate that has never run is not a gate.
- `TRAP` — the `tsconfig.json` copied from `BlasterMaster` omitted `"node"` from `types`
  (that project's tests never import a node builtin), so the first Node-importing test
  reddened the cheap tier with `TS2591: Cannot find name 'node:fs'`. Rule: a copied config
  carries the source project's assumptions; the first real test is what proves the copy.
- `TRAP` — **the dispatcher destroyed an append-only ledger row.** Anchoring a text edit on
  ALL of row 3 in order to insert row 4 *replaced* row 3 instead of appending after it.
  Measured 2026-10-06 during the publish record. Caught by re-reading the file seconds later;
  row 3 was restored BYTE-IDENTICAL from `git show HEAD:docs/DECISION-LEDGER.md` and the fix
  was proven to be a pure addition (`git diff --numstat` = 1 insertion, 0 deletions). Rule: to
  append to an append-only file, anchor the edit on the END of the LAST row (or use a heredoc)
  — never on a whole existing row — and always verify the result is an ADDITION.
- `TRAP` — **the dispatcher's own independent check "disproved" a correct algorithm.** Calling
  the pure picker back-to-back with NO frames between calls gave T 8.71% / I 20.27% against the
  spec's 14.73% / 13.84% — which read as a spec error and was a **model** error: the documented
  distribution assumes frames elapse, each stepping the LFSR. With any realistic gap the
  distribution is ≈14.3% per piece, corroborating the algorithm (docs/NES-MECHANICS.md §11).
  Rule: when an independent check disagrees with a sourced spec, suspect the CHECK'S MODEL
  before the spec — and never brief a writer on a "correction" derived from a bad model.

## Recovery pointers

- Gate command and exit codes (`0` green · `1` failed · `2` cheap only · `9` refused, VOID):
  `bash scripts/gate.sh` · raw logs in `.gate-logs/`.
- Open writer branches/worktrees: `git worktree list` · `git branch -a`.
- The process itself: `~/projects/Toolbox/docs/WAY-OF-WORKING.md`.
