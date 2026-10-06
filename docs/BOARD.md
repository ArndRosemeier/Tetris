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
reconciled: (none — origin does not exist yet; see RECOVERY and BLOCKER below)

SESSION | id=session-76777914-6dab-4bba-975f-d4444ae0ed6d | model=deepseek/deepseek-flash | role=chief-of-staff | state=idle

BOOTSTRAP | sha=<pending first commit> | by=dispatcher | repo initialized, gate + board +
  record + brief in place, skeleton builds; verify=cheap tier exit 2 + full tier exit 0

QUEUE | row=2 | The game's scope/ruleset and the first playable slice | src=docs/DECISION-LEDGER.md
QUEUE | row=3 | Remote repo (github.com/ArndRosemeier/Tetris) — does not exist yet | src=BLOCKER below
QUEUE | row=4 | Publish target apps.futuremagic.de/Tetris (symlink + index entry) | src=the apps-publish skill

BLOCKER | No `origin` remote. `scripts/board.sh` and the remote-reconcile discipline cannot
  run until one exists (it exits CANNOT LOOK). Needs an owner decision, because creating a
  repo on the owner's GitHub account is an external side effect.

RECOVERY | repo=/home/administrator/projects/Tetris | remote=<none yet> | branch=main |
  gate=bash scripts/gate.sh | logs=.gate-logs/ | process=~/projects/Toolbox/docs/WAY-OF-WORKING.md
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

## Recovery pointers

- Gate command and exit codes (`0` green · `1` failed · `2` cheap only · `9` refused, VOID):
  `bash scripts/gate.sh` · raw logs in `.gate-logs/`.
- Open writer branches/worktrees: `git worktree list` · `git branch -a`.
- The process itself: `~/projects/Toolbox/docs/WAY-OF-WORKING.md`.
