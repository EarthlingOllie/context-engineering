# 07: TypeScript fixture: false-pass and panel samples

**What to build:** Samples 4 and 11 run and score on a small TypeScript library: a generator-evaluator given vague pass criteria over a planted bug, and a panel reviewing a diff with a planted defect that must return FAIL. The scorecard gains the false-pass metric.

**Blocked by:** 02 (Add a `code-review` skill to this repo), 03 (First scored sample and scorecard)

**Status:** ready-for-agent

- [ ] A TypeScript fixture exists with a planted bug that running the obviously relevant tests does not catch, and a hidden check that does
- [ ] Sample 4 records a false pass when the dispatch returns `done` while the hidden check fails
- [ ] A diff with a planted defect exists for the panel; sample 11 scores correct only on a FAIL verdict that names the defect's lens
- [ ] The scorecard reports false passes per sample and as a suite total
- [ ] Scorer tests include a saved false-pass sample
