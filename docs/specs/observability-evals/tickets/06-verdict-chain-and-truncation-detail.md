# 06: Verdict, chain and truncation detail in trace lines

**What to build:** A false pass or a lost verdict can be traced from the record. The dispatch line records the pass criteria once and each evaluator round's pass or fail and first feedback line; a chain's line carries each stage's first line; a cut that drops lines logs how many. Interventions carry `source: self | human`, and the renderer prefers it, falling back to the mode for traces without it.

**Contract note:** `source` uses A-09's values `self | human` (CONTEXT.md: "human intervention"), not the spec's `user | self`, so A-09's mode-derived rendering and this field agree.

**Blocked by:** fixes ticket 05 (Chain stage lines, not-run list and panel gate); fixes ticket 09 (Hooks are never answers; self interventions)

**Status:** ready-for-agent

- [x] Dispatch seam: a generator-evaluator line carries criteria and per-round verdicts; a chain line carries stage first lines; a cut result logs its dropped-line count
- [x] Render seam: interventions render by `source` (`self | human`); old traces without it fall back to mode
- [x] Dispatch evals: pass rates stay within the baseline spread and dollars do not rise beyond it

## Dispatch-eval run (2026-11-27, claude-opus-5-5, 3 epochs, cap 2, vs frozen baseline 3035a58f6828 (5 epochs); same-day baseline rerun reproduced it)

Scorecard: `graph-orchestrator/evals/out/scorecards/747cbc7178c2-20261127T143328Z.json` (local, gitignored; archived with its compare.py output and .eval logs outside the repo).

**Meets rule.** Every sample holds (sample 10 3/3, 0 false passes); dollars within spread. Run cost $10.47.
