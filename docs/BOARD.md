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
reconciled: 63a1500 · 2026-10-06T13:30Z

SESSION | id=session-76777914-6dab-4bba-975f-d4444ae0ed6d | model=deepseek/deepseek-flash | role=chief-of-staff | state=idle

LANDED | row=1 | sha=63a15003cf0bb2f5785c09421ea5065305b7c168 | verify=MY OWN: cheap tier
  green (exit 2) + full gate GREEN (exit 0) · 1/1 tests · vite build 58ms · raw log
  .gate-logs/gate.log | arms=4f0fd4092437bea2 (baseline) vs edf3ec532ba1bbda (injected
  APP_VERSION) — arm B RED on the pin `APP_VERSION matches the version in package.json`,
  exit 1; restore verified, tree clean | retired: nothing (no writers dispatched yet) |
  docs=board, ledger row 1, testing per-landing 63a1500 | note=bootstrap only; no game
  code exists yet

QUEUE | row=2 | The game's scope/ruleset and the first playable slice | src=docs/DECISION-LEDGER.md
QUEUE | row=3 | Remote repo (github.com/ArndRosemeier/Tetris) — does not exist yet | src=BLOCKER below
QUEUE | row=4 | Publish target apps.futuremagic.de/Tetris (symlink + index entry) | src=the apps-publish skill

BLOCKER | No `origin` remote. `scripts/board.sh` and the remote-reconcile discipline cannot
  run until one exists (it exits CANNOT LOOK). Needs an owner decision, because creating a
  repo on the owner's GitHub account is an external side effect. Measured 2026-10-06:
  `git ls-remote https://github.com/ArndRosemeier/Tetris.git` → "Repository not found."

RECOVERY | repo=/home/administrator/projects/Tetris | remote=<none yet> | branch=main |
  gate=bash scripts/gate.sh | logs=.gate-logs/ | process=~/projects/Toolbox/docs/WAY-OF-WORKING.md
  | sessions=~/.dsh/sessions/--home-administrator-projects-Tetris--
```

No `LANDED` rows yet: nothing has been independently verified.

## Guards

- **`GUARD` — the suite lock.** `scripts/gate.sh` takes an atomic `mkdir` lock at
  `.gate-lock/` derived from the git common dir, so it is the same path from the main tree
  and every worktree. A second full run is refused (exit 9) and is VOID. Verify: run a full
  gate twice.
- **`GUARD` — the cheap tier cannot pass as a full gate.** `GATE_TESTS=0` exits 2, never 0.
  Verify: `GATE_TESTS=0 bash scripts/gate.sh; echo $?` prints 2.

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

## Recovery pointers

- Gate command and exit codes (`0` green · `1` failed · `2` cheap only · `9` refused, VOID):
  `bash scripts/gate.sh` · raw logs in `.gate-logs/`.
- Open writer branches/worktrees: `git worktree list` · `git branch -a`.
- The process itself: `~/projects/Toolbox/docs/WAY-OF-WORKING.md`.
