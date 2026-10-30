# Spike ADR0002

| item | result | evidence |
|---|---|---|
| 1 | pass | Returned as data: {"status":"done","results":[{"id":"w1-d1","status":"done","result":"/workspace/tmp/spike/mutex.md","artifacts":["/workspace/tmp/spike/mutex.md"],"iterations":1},{"id":"w1-d2","status":"done","result":"/workspace/tmp/spike/leap.js\nExports a dependency-free |
| 2 | pass | log line verbatim: wave: 2 dispatch(es), args keys = now,traceFile,maxAgents,dispatches (args arrived nested, untouched) |
| 3 | queue | Run B: 20/20 probes returned ok; nulls=0, 21 agents done, 0 errors. Effective cap here was 2 not 16 (cap = min(16, nproc−2), nproc=4): agents started in pairs every ~3.5 s, max queue wait 30.9 s. Run C not performed: CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS is read by the harness process at session start and a cloud session cannot set it or restart; behaviour change untested. |
| 4 | pass | iterations=1; w1-d2 status done, 2-line result (path + summary); leap.js correct for 1900/2000/2024/2023 |
| 5 | pass | Added chain topology; one /wave with w3-d1 ran w3-s1 (single) then w3-s2 (generator-evaluator); trace has lines for w3-s1, w3-s2, and w3-d1 with stages:["w3-s1:done","w3-s2:done"]; both artifacts written |
| 6 | pass | /workspace/tmp/spike/trace.jsonl after Run A: wave_start line, one line each for w1-d1 and w1-d2, wave_end line (scribe reported 4); later runs appended correctly |
| 7 | no | Phrase PERIWINKLE-OSTRICH absent from the returned result and from sem.md. Harness did not load .claude/agents/evaluator.md; the worker did Read the file itself via a tool call but still did not follow its instruction. |
