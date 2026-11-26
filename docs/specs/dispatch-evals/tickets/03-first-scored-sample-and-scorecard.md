# 03: First scored sample and scorecard

**What to build:** One command runs sample 1 as a proper Inspect task and writes a scorecard file. This is the walking skeleton every later sample plugs into: the eval harness with its real `Runtime`, the document fixture with planted facts, the scorers, and the scorecard format.

**Blocked by:** 01 (Spike: one dispatch eval end to end)

**Status:** done

- [x] One documented command runs the task and writes a scorecard
- [x] The scorecard header records plugin commit, engine version, Inspect version, model id, concurrency cap, CPU count, memory and epochs; engine, Inspect and model are pinned in the suite
- [x] The sample row records outcome correct (each planted fact stated with its file cited), status truthful (reported equals expected), dollars, input / output / cache-read / cache-write tokens, cache-write share, agent count and wall clock
- [x] Model prices are supplied to Inspect so dollars are computed, and every role runs on `claude-opus-5-5`
- [x] The harness loads the built bundle the way the Workflow harness does and makes no change to the plugin
- [x] The hidden check is not present in the sandbox while agents run
- [x] The real runtime is tested with a stub engine: schema and requested model passed through, timings recorded, an engine failure surfaced as nothing returned or a thrown error
- [x] The scorers are tested as pure functions over a saved sample (result file, trace, file tree), with no model call
- [x] Raw Inspect logs are ignored by git
