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
| 1 | **The project runs the house process and the house browser-game stack.** TypeScript + Vite + Vitest, one gate script, a board as state of record, writers in worktrees. Owner, verbatim: *"please be my chief of staff"*. Evidence: sibling projects (`~/projects/BlasterMaster`) use the identical stack and `~/projects/Toolbox/scaffold/` supplies the gate. Rejected: a bespoke build/test setup, because it would spend the owner's time re-learning what the scaffold already encodes. Unproven: nothing about the game itself — no ruleset decision has been made yet. | `package.json`, `tsconfig.json`, `scripts/gate.sh`, `AGENTS.md` | Bootstraps a project with no repo at all (measured 2026-10-06: `~/projects/Tetris` was empty). | LANDED `<pending first commit>` |
| 2 | **OPEN — the game's scope/ruleset** (rotation system, randomizer, hold, ghost, lock delay, goal mode). Awaiting the owner. Recommendation on the table: modern guideline Tetris. | — | The project name fixes the genre, not the rules; the two candidate rulesets play genuinely differently. | OPEN |
