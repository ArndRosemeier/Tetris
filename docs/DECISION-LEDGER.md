# The decision ledger

**Append-only.** A decision is history; history never rots. Never edit another landing's
row — if a decision is superseded, add a new row that says so and points at the old one.

**This is not a behaviour doc.** Docs that *restate behaviour* rot; docs that *record
decisions* do not. Behaviour lives in a test (the test **is** the statement); this file
holds the decision, the reason, and the pointer to the test.

## The rule for a row

1. **Quote the owner verbatim** when the decision is theirs.
2. **Name the evidence** — the file:line, the measurement, the incident.
3. **Say what was rejected**, and why.
4. **Say what is still unproven.**

Row numbers are assigned by the dispatcher at brief time. See the Toolbox
`docs/DECISION-LEDGER.md` for the full contract.

---

## Ledger

| n | statement | files | why | status |
| ---: | --- | --- | --- | --- |
| 1 | **The project runs the house process and the house browser-game stack.** TypeScript + Vite + Vitest, one gate script, a board as state of record, writers in worktrees. Owner, verbatim: *"please be my chief of staff"*. Evidence: sibling projects (`~/projects/BlasterMaster`) use the identical stack and `~/projects/Toolbox/scaffold/` supplies the gate. Rejected: a bespoke build/test setup, because it would spend the owner's time re-learning what the scaffold already encodes. Unproven: nothing about the game itself — no ruleset decision has been made yet. | `package.json`, `tsconfig.json`, `scripts/gate.sh`, `AGENTS.md` | Bootstraps a project with no repo at all (measured 2026-10-06: `~/projects/Tetris` was empty). | LANDED 63a1500 |
| 2 | **The clone is faithful to NES Tetris (1989), not modern guideline Tetris.** Owner, verbatim, choosing between the options put to him: *"1989 NES-faithful"* — rejecting *"Modern guideline (Recommended)"*. The consequences ARE the deliverable: no hold piece, no ghost piece, no SRS wall kicks, no 7-bag randomiser, NES DAS auto-repeat, NES gravity table and NES scoring. Evidence: this row; the mechanics spec being produced by probe `b496443b`. Rejected: modern guideline Tetris (SRS + wall kicks + 7-bag + hold + ghost), which the dispatcher recommended for modern keyboard and touch feel — the owner chose authenticity, and that choice is not re-litigated. Unproven: the exact NES rotation / wall-bump behaviour and the randomiser algorithm; the simulation slice is NOT briefed until those are pinned, because they are its pins. | `AGENTS.md`, `src/game/**` (to be created) | The project name fixes the genre, not the rules; the two rulesets play genuinely differently and the difference is user-visible on every piece. | IN FORCE — no code yet |
| 3 | **The project lives at github.com/ArndRosemeier/Tetris, public.** Owner, verbatim, on the remote question: *"Yes — create it and push main (Recommended)"*. Evidence: the GitHub API create returned http 201 on 2026-10-06; `git rev-parse HEAD origin/main` both printed `1d0da4023979c2a3a669da8bc0ebaa27b22012ee`. Rejected: keeping the repo local-only, which would have left `scripts/board.sh` exiting `CANNOT LOOK` and given writers nowhere to push. Unproven: nothing. | `.git/config` | The remote-reconcile discipline and push-based verification both require a remote. | LANDED 1d0da40 |
