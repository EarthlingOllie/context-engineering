# 05: Chain stage lines, not-run list and panel gate

**What to build:** A chain reports every stage, names the stages it did not run, and stops at a failing panel. Its result starts with one line per stage (`<stage id> <status>: <first line>`), then the last run stage's lines, cut to the line limit. A chain that stops early appends `not run: <stage ids and titles>`. A non-last panel stage whose result starts `FAIL` stops the chain as `exhausted`, naming the panel, unless the stage sets `gate: false`. REL-04.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] At the dispatch seam: a done chain's result has one line per stage, then the last stage's lines
- [ ] At the dispatch seam: a chain whose stage 1 is exhausted lists the later stages under `not run:`
- [ ] At the dispatch seam: a mid-chain panel FAIL stops the chain as `exhausted` naming the panel; with `gate: false` the chain continues
- [ ] The catalog's chain section describes the gate and its opt-out
- [ ] Dispatch evals: sample 9 rises above its baseline spread, or holds if already passing, and every other sample stays within its spread
