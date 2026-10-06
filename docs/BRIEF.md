# Writer brief — this project's overlay

The brief template itself is **not copied here**: it is cut from the Toolbox
(`~/projects/Toolbox/docs/BRIEF.md`), and a second copy of it would be exactly the
duplication this process exists to prevent. Read that file and fill in its brackets.

This file carries only what is specific to Tetris, and the dispatcher's checklist.

## Project-specific values

| Field | Value |
| --- | --- |
| Repo | `/home/administrator/projects/Tetris` |
| Main branch | `main` (deploys — not a staging area) |
| Worktree convention | `/home/administrator/projects/Tetris/worktrees/<slice>` on branch `slice/<name>` |
| The one gate command | `bash scripts/gate.sh` (cheap tier: `GATE_TESTS=0 bash scripts/gate.sh`) |
| Gate log | `/home/administrator/projects/Tetris/.gate-logs/gate.log` |
| Publish base | `TETRIS_BASE=/Tetris/` (apps.futuremagic.de/Tetris) |
| Ledger rows | `docs/DECISION-LEDGER.md` — assign the row number in the brief |
| Seam index | `docs/ARCHITECTURE.md` — name the ONE seam the slice extends |
| Board | `docs/BOARD.md` — amend in the same commit as the landing |

## Dispatcher's checklist before sending

- [ ] The intent is stated, not just the literal ask.
- [ ] The ONE seam is named, with its location.
- [ ] The ledger row number is assigned from the ledger **now**.
- [ ] The worktree path is absolute and stated twice.
- [ ] Out-of-scope items are named.
- [ ] Pins are phrased as statements, not as "test the feature".
- [ ] The `COPIES:` line is required in the report.
- [ ] The BLOCKED clause is present, including "the brief may be wrong".
