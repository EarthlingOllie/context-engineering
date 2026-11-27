/graph-orchestrator --mode autonomous --scratch /work/scratch

Task, in the repository at /work/repo: add a pytest suite for the `calc` package that covers every public function, including each error case, and make it pass; fix any bug the tests uncover in `calc/`. Put the tests under `tests/`. Use a generator-evaluator dispatch for the suite so an evaluator checks it; one wave is enough. Do not stop until the dispatch has returned and you have integrated its result.
