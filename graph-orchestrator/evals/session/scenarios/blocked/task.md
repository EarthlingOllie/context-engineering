/graph-orchestrator --mode autonomous --scratch /work/scratch

Task, in the repository at /work/repo: add a `node:test` suite for `src/slug.js` under `test/` that covers every exported function, including each error case, and fix any bug the tests uncover. Use one generator-evaluator dispatch whose pass criteria are exactly these two, both countable:

1. `node --test test/` exits 0.
2. `semgrep --config p/javascript --error src/ test/` exits 0 (no findings).

Do not change or drop either criterion. Nobody is available to answer questions during this session.
