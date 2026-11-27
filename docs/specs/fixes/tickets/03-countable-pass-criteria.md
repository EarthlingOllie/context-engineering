# 03: Countable pass criteria

**What to build:** The orchestrator writes pass criteria an evaluator can count, and a generator-evaluator dispatch without them fails instead of inventing "the task is complete and correct". Written guidance only; no code check of the wording.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The catalog's `pass_criteria` entry is required and defines a criterion: a numbered item naming a command or observable and its expected count or output, including the full regression suite or the later gate that runs it
- [x] The catalog lists the words that do not make criteria (relevant, targeted, touched-area, all checks, an except clause) and shows one good example
- [x] At the dispatch seam: a generator-evaluator spec with no pass criteria returns `failed` ("pass_criteria missing") and spends no agents
- [x] Docs seam: the catalog text is asserted
- [ ] Dispatch evals (restated 2026-11-27): sample 16 (`16-generator-evaluator-countable-criteria`, sample 4's task with countable pass criteria that do not name the planted bug's cause and cannot all be met without fixing it: 1. the full suite green; 2. paging through every list of 0 to 50 orders at page sizes 1 to 10 following `hasNext` returns every order once and in order, and the page count (the library's page-count function and the one every visited page reports) equals the number of pages visited, 0 for an empty list, 510 of 510; the criteria never name the identifier `pageCount` or how it rounds. Reaching every order alone is not enough: a `hasNext`-only patch does that while `pageCount` still rounds) has 0 false passes and its pass rate is at or above sample 4's; sample 4 (the vague-criteria guard, still "The relevant tests pass.") has no more false passes than its baseline (0/5); every other sample stays within its spread. Needs a fresh baseline epoch for sample 16 first: the frozen baseline `3035a58f6828` has no rows for it, so `compare.py` lists it as not gated

The original criterion, "sample 4's false-pass rate falls below its baseline spread", could not be met by any build: sample 4's baseline is already 0/5 false passes, and it hard-codes the vague wording this ticket forbids.

## Dispatch-eval run (2026-11-27, claude-opus-5-5, 3 epochs, cap 2, vs frozen baseline 3035a58f6828 (5 epochs); same-day baseline rerun reproduced it)

Scorecard: `graph-orchestrator/evals/out/scorecards/64968bde97fa-20261127T133053Z.json` (local, gitignored; archived with its compare.py output and .eval logs outside the repo).

**Gate not measurable; sample 04 needs rewriting.** Sample 04 false passes: 0/3 (baseline 0/5), so "falls below its spread" cannot be met by any build. The sample still hard-codes `"pass_criteria": "The relevant tests pass."`, the wording this ticket forbids, and a dispatch-only eval never exercises the catalog guidance. Rewrite sample 04 (or add a countable-criteria variant that must catch the planted bug) and restate this criterion before another run (HUMAN-TODO D3). **Done 2026-11-27:** sample 04 kept as the vague-criteria guard, sample 16 added with countable criteria, and the dispatch-eval box above restated; D3 now waits only on a fresh baseline epoch for sample 16 and a paid run (no paid run made: API credit exhausted).

Other samples: sample 14 2/3 correct vs 5/5 (one epoch ended `exhausted` and said so truthfully; this ticket changes no relay prompt; likely noise). Dollar flag: sample 02 +$0.054 (band $0.024), cache writes. Run cost $10.99. By the rule as written: fails rule on 14.
