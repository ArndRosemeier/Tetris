# Tetris — agent/workspace rules

A browser Tetris: TypeScript + Vite, rendered to a canvas, tested with Vitest, published
as a static app under `apps.futuremagic.de/Tetris`.

Read the relevant doc under `docs/` before working on an area. Start with the seam index,
`docs/ARCHITECTURE.md` — it names the ONE way to do each thing.

The full process — roles, the board, verification doctrine, the brief template — is the
shared doc `WAY-OF-WORKING.md` in the Toolbox repo (`~/projects/Toolbox/docs/`). Read it
when you are new to this workflow. This file holds only what is **binding here**.

## Binding engineering rules

1. **The simulation is pure and separate from rendering.** Game state advances through one
   pure step function; the renderer only draws it. Anything that reads the canvas, the
   clock or `Math.random` directly from game logic is a defect.
2. **Randomness comes from one seeded seam, never `Math.random` inline.** A piece sequence
   must be reproducible from a seed, or its bugs are not.
3. **No silent fallbacks.** When data, parsing or a step fails, propagate a LOUD error.
   Forbidden: `catch`-and-continue around parsing, logging an error with no user-visible
   surface, placeholder values standing in for required data.
4. **Validate at every boundary.** Persisted state (high score, settings) is parsed against
   a schema; a validation failure fails the step and never becomes empty data.
5. **Centralize, and keep it simple.** When one idea is implemented in more than one place,
   make it ONE seam and route callers through it. When you touch an already-distributed
   pattern, folding it is part of the change — unless that is genuinely more expensive than
   the defect, in which case say so in writing where the next reader will hit it.
6. **A cross-cutting discovery starts with the seam question, and the answer is WRITTEN
   DOWN.** Every brief and every landing report carries ONE greppable line:
   `COPIES: n→1 — <the seam that now carries it>` when copies were folded, or
   `COPIES: 1 — checked, no duplication (grepped: <what>)` when the change is genuinely
   single-site. A brief without it is incomplete; a landing without it is not verified.

## Standing rule: critique the instruction

**The owner's instructions are INTENT, not design.**

1. **Extract the intent first** — the felt problem behind the literal ask.
2. **Say it when the ask is flawed**, plainly and briefly, with the better route and its
   reasoning.
3. **Do not silently substitute.** A different design may replace the asked-for one only
   when it serves the SAME intent *and* the owner has been told.
4. **Judge the friction.** Minor imperfections get decided in one line, not debated.
5. **Route the critique through reality, not taste.** "This breaks X, here is the code that
   proves it" is a critique; "this feels off" is not.
6. **Bind briefs to it too.** Every brief tells the writer to report BLOCKED — with
   evidence — rather than implement something it can prove is wrong, including when the
   flaw is in the brief's own design.
7. **The decision stays the owner's.** Present the better way once; if the owner reaffirms,
   execute it well and stop re-arguing.

## Parallel writers

Read-only agents always run in parallel. **At most TWO writing agents** may be in flight,
and only in **separate worktrees** (`git worktree add`) — writers sharing one working tree
share one git index, and `git commit` commits the whole index, so file disjointness does
NOT protect the commit phase.

1. **File disjointness applies to source files and CANNOT hold for the docs.** Every
   landing amends the board and usually the ledger, so two concurrent writers WILL conflict
   there. The dispatcher assigns the ledger row number in every brief; a writer that still
   hits a docs conflict resolves it as a mechanical UNION, renumbers its OWN row only,
   touches nothing of the other landing, proves that with `git diff --name-only`, re-gates
   on the rebased tree, and pushes.
2. **A conflict anywhere else** means the disjointness check missed something: STOP and
   report; do not resolve it.
3. **Rebase before every push** (`git pull --rebase origin main`), then push. The main
   branch deploys, so it is not a staging area.
4. **Absolute paths in every brief.** Every shell call runs in a fresh shell whose cwd is
   the session workspace, and file tools resolve relative paths against it — so a writer
   told to work in a worktree edits the MAIN tree unless every path is absolute.
5. **Worktrees live INSIDE the repo** (`<repo>/worktrees/<slice>`, gitignored) — never in
   `/tmp`.
6. **A writer that cannot finish must COMMIT the coherent partial state on its branch and
   report BLOCKED.** Uncommitted work dies with the session.
7. **Cadence contract.** Writers report on LANDING or BLOCKED, nothing in between.

## The gate

One command. Run it; do not invent another.

```bash
bash scripts/gate.sh                 # full: build + suite (takes the lock)
GATE_TESTS=0 bash scripts/gate.sh    # cheap tier only: build (takes NO lock)
```

Exit codes (`0` green · `1` red · `2` cheap tier only · `9` refused, VOID) are defined in
`scripts/gate.sh`; the contract is in the Toolbox `docs/GATE.md`.

- **The cheap tier blocks a push; the expensive tier makes a change VERIFIED.**
- **A red gate is information, not an obstacle.** Fix the cause; never re-run until green.
- **Never pipe a check through `tail`/`head`** — it destroys the failing evidence, and the
  pipeline's exit status becomes the last command's, so unverified work lands under a
  message claiming a pass.
- **One expensive check at a time**, enforced by the lock, not by a glance.

## Publishing

The app builds to `dist/` and is published under `apps.futuremagic.de/Tetris`, so the build
carries `TETRIS_BASE=/Tetris/`. Use the `apps-publish` skill; do not hand-roll a deploy.

## Host hygiene

1. **At most two writers in flight.** Count the registry before dispatching.
2. **No synthetic load, ever.** A flake is proved deterministic by delaying its cause,
   never by loading the machine.
3. **Every run carries a memory ceiling**, and one suite runs at a time.
4. **An interrupted turn's processes are the dispatcher's to reap** — the audit includes
   **browsers** (`chrome`, `chromium`, `headless_shell`, `playwright`), not only test
   runners.
5. **Kill by PID captured in a SEPARATE call — never by a pattern in the same shell.**
   Capture (`pgrep -f '<pat>' > pids.txt`), then kill (`xargs -r kill < pids.txt`), then
   verify with a count that cannot self-match (`ps -eo comm= | grep -c '^chrome$'`).
6. **A headless browser is a process TREE, and its kill belongs in a `trap`.**
7. **Nothing outlives the writer:** scratch harnesses live under its own worktree, never
   `/tmp`; every process it starts — a browser included — is killed before it reports.
