# 06: Python fixture: review-loop and chain samples

**What to build:** Samples 3, 5, 8 and 9 run and score on a small Python package: a generator-evaluator that should finish, one that must end exhausted, the chained single-then-generator-evaluator pattern, and a chain whose second stage fails. Roles load this repo's skills in the sandbox, and the scorecard gains cost by role.

**Blocked by:** 02 (Add a `code-review` skill to this repo), 03 (First scored sample and scorecard)

**Status:** ready-for-agent

- [ ] A Python fixture exists with pytest, a build-this-feature task, visible tests, and stricter hidden tests kept out of the sandbox until scoring
- [ ] Generator roles name `test-driven-development` and evaluator roles name `code-review`, both installed from this repo at the commit under test
- [ ] Sample 3 scores outcome correct only when the hidden tests pass
- [ ] Sample 5 returns `exhausted` after 2 rounds and scores status truthful
- [ ] Sample 8 completes both stages and scores by the hidden tests
- [ ] Sample 9 stops at stage 2 and the score checks the chain reports that stage and its status
- [ ] The scorecard reports dollars and tokens per role (generator, evaluator, scribe and so on)
- [ ] Scorer tests include a saved `exhausted` sample
