# 03: Countable pass criteria

**What to build:** The orchestrator writes pass criteria an evaluator can count, and a generator-evaluator dispatch without them fails instead of inventing "the task is complete and correct". Written guidance only; no code check of the wording.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The catalog's `pass_criteria` entry is required and defines a criterion: a numbered item naming a command or observable and its expected count or output, including the full regression suite or the later gate that runs it
- [x] The catalog lists the words that do not make criteria (relevant, targeted, touched-area, all checks, an except clause) and shows one good example
- [x] At the dispatch seam: a generator-evaluator spec with no pass criteria returns `failed` ("pass_criteria missing") and spends no agents
- [x] Docs seam: the catalog text is asserted
- [ ] Dispatch evals: sample 4's false-pass rate falls below its baseline spread, and every other sample stays within its spread

## Dispatch-eval run (2026-11-27, claude-opus-5-5, 3 epochs, cap 2, vs frozen baseline 3035a58f6828 (5 epochs); same-day baseline rerun reproduced it)

Scorecard: `graph-orchestrator/evals/out/scorecards/64968bde97fa-20261127T133053Z.json` (local, gitignored; archived with its compare.py output and .eval logs outside the repo).

**Gate not measurable; sample 04 needs rewriting.** Sample 04 false passes: 0/3 (baseline 0/5), so "falls below its spread" cannot be met by any build. The sample still hard-codes `"pass_criteria": "The relevant tests pass."`, the wording this ticket forbids, and a dispatch-only eval never exercises the catalog guidance. Rewrite sample 04 (or add a countable-criteria variant that must catch the planted bug) and restate this criterion before another run (HUMAN-TODO D3).

Other samples: sample 14 2/3 correct vs 5/5 (one epoch ended `exhausted` and said so truthfully; this ticket changes no relay prompt; likely noise). Dollar flag: sample 02 +$0.054 (band $0.024), cache writes. Run cost $10.99. By the rule as written: fails rule on 14.
