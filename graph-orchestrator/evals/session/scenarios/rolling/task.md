/graph-orchestrator --mode autonomous --scratch /work/scratch

Task, in the repository at /work/repo (Python 3, standard library only). Three pieces of work:

A. Rename the field `qty` to `quantity` in `inventory/model.py` (`Item`), keeping a read-only `qty` property as a deprecated alias. A one-file change.
B. Write a thorough `unittest` suite for `inventory/report.py` under `tests/`, covering every function and each error case, and fix any bug it uncovers. Use one generator-evaluator dispatch whose pass criterion is countable: `python -m unittest discover -s tests` exits 0 with at least 12 tests.
C. Add a `--min-quantity N` option to `inventory/cli.py` that lists only items whose `quantity` is at least N. C uses the renamed field, so it builds on A; it does not need B.

A and B are independent of each other. Plan the dispatches so independent work runs in parallel and nothing waits longer than it must. Nobody is available to answer questions during this session.
