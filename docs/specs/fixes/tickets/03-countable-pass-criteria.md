# 03: Countable pass criteria

**What to build:** The orchestrator writes pass criteria an evaluator can count, and a generator-evaluator dispatch without them fails instead of inventing "the task is complete and correct". Written guidance only; no code check of the wording.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The catalog's `pass_criteria` entry is required and defines a criterion: a numbered item naming a command or observable and its expected count or output, including the full regression suite or the later gate that runs it
- [x] The catalog lists the words that do not make criteria (relevant, targeted, touched-area, all checks, an except clause) and shows one good example
- [x] At the dispatch seam: a generator-evaluator spec with no pass criteria returns `failed` ("pass_criteria missing") and spends no agents
- [x] Docs seam: the catalog text is asserted
- [ ] Dispatch evals: sample 4's false-pass rate falls below its baseline spread, and every other sample stays within its spread
