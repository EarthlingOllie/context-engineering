import { test } from "node:test";
import assert from "node:assert/strict";
import { runWorkflow, traceFileOf } from "../src/run.ts";
import { agentDemand } from "../src/topologies.ts";
import { baseArgs, eventsOf, fakeRuntime, spec, wave, roleOf } from "./helpers.ts";

// ---------- single ----------

test("single: one worker call, one done result, prompt carries stance, context, skill, instructions and contract", async () => {
  const { out, calls, labels, roles } = await wave(
    [spec({ id: "w1-d1", topology: "single", task: "Write the leap-year helper", context: ["tests live in test/", "use node:test"], roles: { worker: { skill: "tdd", instructions: "red first" } } })],
    { Worker: { result: "/scratch/t/leap.js\nexports isLeap", artifacts: ["/scratch/t/leap.js"], blocked: false } },
  );
  assert.deepEqual(labels(), ["Worker: Write the leap-year helper", "Trace scribe: w1-d1 trace lines"]);
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.iterations, 1);
  assert.deepEqual(r.artifacts, ["/scratch/t/leap.js"]);
  assert.equal(r.result, "/scratch/t/leap.js\nexports isLeap");
  const p = calls[0]!.prompt;
  assert.match(p, /ROLE: worker/);
  assert.match(p, /You are a worker/);
  assert.match(p, /TASK: Write the leap-year helper/);
  assert.match(p, /- tests live in test\//);
  assert.match(p, /- use node:test/);
  assert.match(p, /SKILL: load and follow the skill `tdd`/);
  assert.match(p, /INSTRUCTIONS:\nred first/);
  assert.match(p, /RETURN: at most 5 lines — one verdict line\. Nothing else/);
  assert.match(p, /ARTIFACTS: .*\/scratch\/t\//);
  assert.equal(calls[0]!.opts.phase, undefined);
  assert.ok(calls[0]!.opts.schema, "worker call carries the role schema");
});

test("single: blocked output short-circuits to a blocked result with the question", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "single" })], { Worker: { result: "", artifacts: [], blocked: true, question: "Which database?" } });
  assert.equal(out.results[0]!.status, "blocked");
  assert.equal(out.results[0]!.question, "Which database?");
  const ev = out.events.find((e) => e.type === "dispatch")!;
  assert.equal((ev as { question?: string }).question, "Which database?");
});

// ---------- generator-evaluator ----------

test("generator-evaluator: stops on first pass; round 2 generator sees feedback but not its own previous output", async () => {
  const { out, calls, labels, roles } = await wave(
    [spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 3, pass_criteria: "tests pass" }, roles: { generator: { instructions: "gen" }, evaluator: { skill: "code-review", instructions: "eval" } } })],
    {
      "Generator (1": { result: "FIRST-ATTEMPT-TEXT", artifacts: ["/scratch/t/a.js"], blocked: false },
      "Generator (2": { result: "second attempt", artifacts: ["/scratch/t/a.js"], blocked: false },
      "Evaluator (1": { pass: false, feedback: "1. missing null check at a.js:3", blocked: false },
      "Evaluator (2": { pass: true, feedback: "", blocked: false },
    },
  );
  assert.deepEqual(roles(), [
    "Generator (1 of 3)",
    "Evaluator (1 of 3)",
    "Generator (2 of 3)",
    "Evaluator (2 of 3)",
    "Trace scribe",
  ]);
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.iterations, 2);
  assert.equal(r.result, "second attempt");
  const ev1 = calls[1]!.prompt;
  assert.match(ev1, /ROLE: evaluator/);
  assert.match(ev1, /PASS CRITERIA:\ntests pass/);
  assert.match(ev1, /SUBMISSION \(round 1\):\nFIRST-ATTEMPT-TEXT/);
  assert.match(ev1, /SKILL: load and follow the skill `code-review`/);
  const gen2 = calls[2]!.prompt;
  assert.match(gen2, /FEEDBACK \(evaluator, round 1\):\n1\. missing null check at a\.js:3/);
  assert.doesNotMatch(gen2, /FIRST-ATTEMPT-TEXT/);
  assert.match(gen2, /\/scratch\/t\/a\.js/);
  assert.doesNotMatch(calls[0]!.prompt, /FEEDBACK \(evaluator/);
});

test("generator-evaluator: returns exhausted at the iteration cap; the feedback line survives a full-length result", async () => {
  const { out, labels, roles } = await wave(
    [spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 2, pass_criteria: "x" }, returns: { shape: "x", maxLines: 3 } })],
    { Generator: { result: "l1\nl2\nl3", artifacts: [], blocked: false }, Evaluator: { pass: false, feedback: "still wrong\nmore detail", blocked: false } },
  );
  assert.equal(roles().length, 5);
  const r = out.results[0]!;
  assert.equal(r.status, "exhausted");
  assert.equal(r.iterations, 2);
  assert.equal(r.result, "l1\nl2\n-- exhausted after 2 round(s); last evaluator feedback: still wrong");
  assert.equal(r.result.split("\n").length, 3);
});

test("generator-evaluator: defaults to 3 iterations and short-circuits when the evaluator is blocked", async () => {
  const { out, labels, roles } = await wave(
    [spec({ id: "w1-d1", topology: "generator-evaluator", params: { pass_criteria: "x" } })],
    { Generator: { result: "attempt", artifacts: [], blocked: false }, "Evaluator (1": { pass: false, feedback: "", blocked: true, question: "Is the legacy API in scope?" } },
  );
  assert.deepEqual(roles(), ["Generator (1 of 3)", "Evaluator (1 of 3)", "Trace scribe"]);
  assert.equal(out.results[0]!.status, "blocked");
  assert.equal(out.results[0]!.question, "Is the legacy API in scope?");
  assert.equal(out.results[0]!.iterations, 1);
  assert.equal(agentDemand(spec({ id: "x", topology: "generator-evaluator" })), 6);
});

// ---------- fan-out ----------

test("fan-out: explicit split runs one branch per sub-task in parallel and concatenates without a reducer", async () => {
  const { out, calls, labels, roles } = await wave(
    [spec({ id: "w1-d1", topology: "fan-out", task: "Survey the three modules", params: { split: ["module a", "module b", "module c"] }, returns: { shape: "a line per module", maxLines: 6 } })],
    { "Worker (1 of 3)": { result: "a: fine", artifacts: ["/scratch/t/a.md"], blocked: false }, "Worker (2 of 3)": { result: "b: fine", artifacts: [], blocked: false }, "Worker (3 of 3)": { result: "c: fine", artifacts: [], blocked: false } },
  );
  assert.deepEqual(labels(), ["Worker (1 of 3): module a", "Worker (2 of 3): module b", "Worker (3 of 3): module c", "Trace scribe: w1-d1 trace lines"]);
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, "[1] a: fine\n[2] b: fine\n[3] c: fine");
  assert.deepEqual(r.artifacts, ["/scratch/t/a.md"]);
  assert.match(calls[1]!.prompt, /TASK: module b/);
  assert.match(calls[1]!.prompt, /branch 2 of 3 of a fan-out whose parent task is: Survey the three modules/);
  assert.match(calls[1]!.prompt, /RETURN: at most 2 lines/);
});

test("fan-out: a split wider than 9 returns over_budget without spending agents", async () => {
  const { out, labels, roles } = await wave([spec({ id: "w1-d1", topology: "fan-out", params: { split: Array.from({ length: 10 }, (_, i) => `part ${i}`) } })]);
  assert.deepEqual(roles().filter((l) => l !== "Trace scribe"), [], "no role agent runs");
  assert.equal(out.results[0]!.status, "over_budget");
  assert.match(out.results[0]!.result, /width cap of 9/);
});

test("fan-out: the reducer runs over finished branches and a blocked branch blocks only itself", async () => {
  const { out, calls } = await wave(
    [spec({ id: "w1-d1", topology: "fan-out", params: { split: ["x", "y", "z"] }, roles: { reducer: { instructions: "merge by theme" } } })],
    {
      "Worker (1 of 3)": { result: "x done", artifacts: [], blocked: false },
      "Worker (2 of 3)": { result: "", artifacts: [], blocked: true, question: "Need prod credentials for y" },
      "Worker (3 of 3)": { result: "z done", artifacts: ["/scratch/t/z.md"], blocked: false },
      Reducer: { result: "merged x and z; y missing", artifacts: ["/scratch/t/merged.md"], blocked: false },
    },
  );
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, "merged x and z; y missing");
  assert.match(r.question!, /branch 2 \(y\): Need prod credentials for y/);
  assert.deepEqual(r.artifacts, ["/scratch/t/z.md", "/scratch/t/merged.md"]);
  const red = calls.find((c) => roleOf(c.opts.label) === "Reducer")!.prompt;
  assert.match(red, /ROLE: reducer/);
  assert.match(red, /BRANCH RESULTS:/);
  assert.match(red, /branch 1 \(done\) — x\nx done/);
  assert.match(red, /branch 2 \(blocked\) — y\nGAP: Need prod credentials for y/);
  assert.match(red, /INSTRUCTIONS:\nmerge by theme/);
  assert.match(red, /RETURN: at most 5 lines/, "reducer gets the full contract");
  assert.match(calls[0]!.prompt, /RETURN: at most 5 lines/, "branches get the full contract when a reducer merges");
});

test("fan-out: a blocked reducer keeps the blocked branches' questions alongside its own", async () => {
  const { out } = await wave(
    [spec({ id: "w1-d1", topology: "fan-out", params: { split: ["x", "y"] }, roles: { reducer: { instructions: "merge" } } })],
    {
      "Worker (1 of 2)": { result: "x done", artifacts: ["/scratch/t/x.md"], blocked: false },
      "Worker (2 of 2)": { result: "", artifacts: [], blocked: true, question: "Need prod credentials for y" },
      Reducer: { result: "partial merge", artifacts: [], blocked: true, question: "Merge x alone, or wait for y?" },
    },
  );
  const r = out.results[0]!;
  assert.equal(r.status, "blocked");
  assert.equal(r.result, "partial merge");
  assert.deepEqual(r.artifacts, ["/scratch/t/x.md"]);
  assert.match(r.question!, /^Merge x alone, or wait for y\?\nbranch 2 \(y\): Need prod credentials for y$/, "the reducer's question first, then the gaps");
});

test("fan-out: a reducer that returns nothing is logged and the finished branch results are concatenated instead", async () => {
  const { out, logs } = await wave(
    [spec({ id: "w1-d1", topology: "fan-out", params: { split: ["x", "y", "z"] }, roles: { reducer: { instructions: "merge by theme" } } })],
    {
      "Worker (1 of 3)": { result: "x done", artifacts: ["/scratch/t/x.md"], blocked: false },
      "Worker (2 of 3)": { result: "", artifacts: [], blocked: true, question: "Need prod credentials for y" },
      "Worker (3 of 3)": { result: "z done", artifacts: [], blocked: false },
      Reducer: null,
    },
  );
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, "[1] x done\n[2] blocked: Need prod credentials for y\n[3] z done");
  assert.deepEqual(r.artifacts, ["/scratch/t/x.md"]);
  assert.match(r.question!, /branch 2 \(y\): Need prod credentials for y/);
  assert.ok(logs.some((l) => /w1-d1: reducer returned nothing/.test(l)));
});

test("fan-out: all branches blocked makes the dispatch blocked", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "fan-out", params: { split: ["x", "y"] } })], { Worker: { result: "", artifacts: [], blocked: true, question: "who owns this?" } });
  assert.equal(out.results[0]!.status, "blocked");
  assert.match(out.results[0]!.question!, /branch 1 \(x\): who owns this\?\nbranch 2 \(y\): who owns this\?/);
});

test("fan-out: a partition instruction runs a partition agent first, then at most `width` branches", async () => {
  const { out, calls, labels, roles } = await wave(
    [spec({ id: "w1-d1", topology: "fan-out", params: { width: 2, split: "split by package" } })],
    { Partition: { subtasks: ["pkg a", "pkg b", "pkg c"], blocked: false } },
  );
  assert.deepEqual(labels(), ["Partition: do w1-d1", "Worker (1 of 2): pkg a", "Worker (2 of 2): pkg b", "Trace scribe: w1-d1 trace lines"]);
  assert.match(calls[0]!.prompt, /PARTITION INSTRUCTION:\nsplit by package/);
  assert.match(calls[0]!.prompt, /at most 2 independent sub-tasks/);
  assert.match(calls[1]!.prompt, /TASK: pkg a/);
  assert.equal(out.results[0]!.status, "done");
  assert.equal(agentDemand(spec({ id: "x", topology: "fan-out", params: { width: 2, split: "s", reducer: true } })), 4);
});

// ---------- chain ----------

test("chain: runs stages in order, forwards artifacts, records stage statuses and stage trace lines", async () => {
  const { out, calls, labels, roles } = await wave(
    [
      spec({
        id: "w3-d1",
        topology: "chain",
        context: ["chain-wide fact"],
        params: {
          stages: [
            { id: "w3-s1", topology: "single", task: "research", context: ["stage fact"], roles: {}, params: {}, returns: { shape: "path", maxLines: 2 }, dependsOn: [] },
            { id: "w3-s2", topology: "generator-evaluator", task: "write it up", params: { max_iterations: 2, pass_criteria: "reads well" } },
          ],
        },
      }),
    ],
    {
      "Link 1 · Single, Worker": { result: "/scratch/t/research.md\nthree findings", artifacts: ["/scratch/t/research.md"], blocked: false },
      Generator: { result: "/scratch/t/writeup.md", artifacts: ["/scratch/t/writeup.md"], blocked: false },
    },
  );
  assert.deepEqual(labels(), ["Link 1 · Single, Worker: research", "Link 2 · Generator-evaluator, Generator (1 of 2): write it up", "Link 2 · Generator-evaluator, Evaluator (1 of 2): write it up", "Trace scribe: w3-d1 trace lines"]);
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.iterations, 2);
  assert.deepEqual(r.stages, ["w3-s1:done", "w3-s2:done"]);
  assert.equal(r.result, "/scratch/t/writeup.md");
  assert.deepEqual(r.artifacts, ["/scratch/t/research.md", "/scratch/t/writeup.md"]);
  assert.match(calls[0]!.prompt, /- chain-wide fact\n- stage fact/);
  assert.match(calls[1]!.prompt, /- w3-s1 \(done\) returned: \/scratch\/t\/research\.md\n- artifacts from w3-s1: \/scratch\/t\/research\.md/);
  assert.match(calls[1]!.prompt, /RETURN: at most 5 lines/, "a stage without returns inherits the chain's contract");
  const types = out.events.map((e) => (e.type === "dispatch" ? `${e.id}${e.parent ? `<${e.parent}` : ""}` : e.type));
  assert.deepEqual(types, ["w3-s1<w3-d1", "w3-s2<w3-d1", "w3-d1"]);
  const chainEv = out.events.find((e) => e.type === "dispatch" && e.id === "w3-d1") as { stages?: string[] };
  assert.deepEqual(chainEv.stages, ["w3-s1:done", "w3-s2:done"]);
});

test("chain: stops at the first stage that is not done and carries its status and question", async () => {
  const { out, labels, roles } = await wave(
    [spec({ id: "w1-d1", topology: "chain", params: { stages: [{ topology: "single", task: "a" }, { topology: "single", task: "b" }] } })],
    { "Link 1 · Single, Worker": { result: "", artifacts: [], blocked: true, question: "Which region?" } },
  );
  assert.deepEqual(labels(), ["Link 1 · Single, Worker: a", "Trace scribe: w1-d1 trace lines"]);
  const r = out.results[0]!;
  assert.equal(r.status, "blocked");
  assert.equal(r.question, "Which region?");
  assert.deepEqual(r.stages, ["w1-d1-s1:blocked"]);
  assert.equal(r.iterations, 1);
  assert.equal(agentDemand(spec({ id: "x", topology: "chain", params: { stages: [{ topology: "single" }, { topology: "generator-evaluator", params: { max_iterations: 2 } }] } })), 5);
});

// ---------- result shaping and malformed specs ----------

test("result shaping: inline result is cut to maxLines and maxLines is clamped to 20", async () => {
  const six = ["1", "2", "3", "4", "5", "6"].join("\n");
  const { out, calls } = await wave(
    [spec({ id: "w1-d1", topology: "single", returns: { shape: "x", maxLines: 3 } }), spec({ id: "w1-d2", topology: "single", returns: { shape: "y", maxLines: 50 } })],
    { Worker: { result: six, artifacts: [], blocked: false } },
  );
  assert.equal(out.results[0]!.result, "1\n2\n3");
  assert.equal(out.results[1]!.result, six);
  assert.match(calls[1]!.prompt, /RETURN: at most 20 lines/);
});

test("malformed specs: unknown topology, missing id, missing task and non-object all return failed rather than throwing", async () => {
  const { out, labels, roles } = await wave([
    { ...spec({ id: "w1-d1", topology: "single" }), topology: "tournament" as never },
    { ...spec({ id: "", topology: "single" }) },
    spec({ id: "w1-d3", topology: "single", task: "" }),
    null as never,
  ]);
  assert.deepEqual(roles(), ["Trace scribe", "Trace scribe", "Trace scribe", "Trace scribe"], "no role agent runs; each workflow still writes its line");
  assert.deepEqual(
    out.results.map((r) => r.status),
    ["failed", "failed", "failed", "failed"],
  );
  assert.match(out.results[0]!.result, /unknown topology "tournament"/);
  assert.equal(out.events.filter((e) => e.type === "dispatch").length, 4);
});

test("an agent that throws yields a failed result for that dispatch and the other workflows are untouched", async () => {
  const { out, logs } = await wave([spec({ id: "w1-d1", topology: "single" }), spec({ id: "w1-d2", topology: "single" })], {
    "w1-d1 Worker": () => {
      throw new Error("boom");
    },
  });
  assert.equal(out.results[0]!.status, "failed");
  assert.match(out.results[0]!.result, /worker returned nothing/);
  assert.ok(logs.some((l) => /^w1-d1: Worker: do w1-d1 threw: boom/.test(l)), "the error is logged");
  assert.equal(out.results[1]!.status, "done");
  assert.equal(out.results[0]!.scribe?.appended, 1);
});

test("a role that throws mid-topology is logged and the result keeps what the topology had already accumulated", async () => {
  const { out, logs } = await wave(
    [
      spec({ id: "w1-d1", topology: "fan-out", params: { split: ["a", "b"] }, roles: { reducer: { instructions: "merge" } } }),
      spec({ id: "w1-d2", topology: "generator-evaluator", params: { max_iterations: 3 } }),
    ],
    {
      "Worker (1 of 2)": { result: "a done", artifacts: ["/scratch/t/a.md"], blocked: false },
      "Worker (2 of 2)": { result: "b done", artifacts: ["/scratch/t/b.md"], blocked: false },
      Reducer: () => {
        throw new Error("reducer crashed");
      },
      Generator: { result: "draft", artifacts: ["/scratch/t/gen.md"], blocked: false },
      "Evaluator (1": { pass: false, feedback: "again", blocked: false },
      "Evaluator (2": () => {
        throw new Error("evaluator crashed");
      },
    },
  );
  // A thrown reducer takes the same path as one that returned nothing: the branch results are concatenated (C6).
  const fan = out.results[0]!;
  assert.equal(fan.status, "done");
  assert.equal(fan.result, "[1] a done\n[2] b done");
  assert.deepEqual(fan.artifacts, ["/scratch/t/a.md", "/scratch/t/b.md"]);
  assert.equal(fan.iterations, 1);
  assert.ok(logs.some((l) => /w1-d1: reducer returned nothing; the branch results are concatenated instead/.test(l)));
  const ge = out.results[1]!;
  assert.equal(ge.status, "failed");
  assert.match(ge.result, /evaluator returned nothing in round 2/);
  assert.equal(ge.iterations, 2);
  assert.deepEqual(ge.artifacts, ["/scratch/t/gen.md"], "the generator's artifacts from the rounds already spent survive");
  assert.ok(logs.some((l) => /^w1-d1: Reducer: do w1-d1 threw: reducer crashed/.test(l)), "the reducer's error is logged");
  assert.ok(logs.some((l) => /^w1-d2: Evaluator \(2 of 3\): do w1-d2 threw: evaluator crashed/.test(l)), "the evaluator's error is logged");
});

// ---------- one workflow per dispatch: demand, refusals, trace, scribe ----------

test("demand log: each workflow logs its own dispatch's agent need, with the scribe stated apart", async () => {
  const dispatches = [
    spec({ id: "w2-d1", topology: "single" }),
    spec({ id: "w2-d2", topology: "generator-evaluator", params: { max_iterations: 3 } }),
    spec({ id: "w2-d3", topology: "fan-out", params: { split: ["a", "b", "c", "d"] }, roles: { reducer: { instructions: "" } } }),
    spec({ id: "w2-d4", topology: "chain", params: { stages: [{ topology: "single", task: "a" }, { topology: "single", task: "b" }] } }),
  ];
  const { logs } = await wave(dispatches);
  for (const line of ["w2-d1: single, up to 1 agent(s) + 1 scribe", "w2-d2: generator-evaluator, up to 6 agent(s) + 1 scribe", "w2-d3: fan-out, up to 5 agent(s) + 1 scribe", "w2-d4: chain, up to 2 agent(s) + 1 scribe"]) {
    assert.ok(logs.includes(line), `logged: ${line}`);
  }
});

test("hard limit: a dispatch whose demand and scribe exceed the 1000-agent run limit returns over_budget unrun", async () => {
  const stage = { topology: "generator-evaluator", task: "s", params: { max_iterations: 5 } }; // 10 agents each
  const big = spec({ id: "w1-d1", topology: "chain", params: { stages: Array.from({ length: 100 }, () => stage) } }); // 1000 + scribe
  const fits = spec({ id: "w1-d2", topology: "chain", params: { stages: Array.from({ length: 99 }, () => stage) } }); // 990 + scribe
  assert.equal(agentDemand(big), 1000);
  const { out, calls } = await wave([big, fits]);
  assert.equal(out.results[0]!.status, "over_budget");
  assert.match(out.results[0]!.result, /1000-agent run limit/);
  assert.equal(out.results[1]!.status, "done");
  assert.ok(!calls.some((c) => c.dispatch === "w1-d1" && roleOf(c.opts.label) !== "Trace scribe"), "the refused dispatch spends only its scribe");
});

test("dependsOn: an earlier wave is recorded in the trace; a same-wave id fails unrun, since parallel workflows cannot wait on each other", async () => {
  const { out, roles, calls } = await wave([
    spec({ id: "w2-d1", topology: "single", dependsOn: ["w1-d1", "w1-d3"] }),
    spec({ id: "w2-d2", topology: "single", dependsOn: ["w1-d2", "w2-d1"] }),
  ]);
  assert.deepEqual(
    out.results.map((r) => [r.id, r.status, r.iterations]),
    [
      ["w2-d1", "done", 1],
      ["w2-d2", "failed", 0],
    ],
  );
  assert.match(out.results[1]!.result, /dependsOn names w2-d1 from the same wave.*use a chain, or dispatch this next wave/);
  assert.equal(roles().filter((l) => l === "Worker").length, 1);
  assert.ok(!calls.some((c) => c.dispatch === "w2-d2" && roleOf(c.opts.label) === "Worker"));
  const ev = out.events.find((e) => e.type === "dispatch" && e.id === "w2-d1") as { dependsOn: string[] };
  assert.deepEqual(ev.dependsOn, ["w1-d1", "w1-d3"]);
});

test("the scribe writes the dispatch's own trace file: humans first, stamped with now when undated, then the dispatch line with its title and time", async () => {
  const { out, calls } = await wave([spec({ id: "w2-d1", title: "Add  the retry\npolicy", topology: "single", dependsOn: ["w1-d2"] })], {}, {
    humans: [{ type: "human", trigger: "blocked", dispatch: "w1-d2", question: "Which DB?", answer: "postgres", mode: "attended" }],
  });
  const [first, second] = out.events as Array<{ type: string; at?: string; answer?: string; title?: string; wave?: number }>;
  assert.equal(first!.type, "human");
  assert.equal(first!.at, baseArgs.now);
  assert.equal(first!.answer, "postgres");
  assert.equal(second!.type, "dispatch");
  assert.equal(second!.title, "Add the retry policy");
  assert.equal(second!.at, baseArgs.now);
  assert.equal(second!.wave, 2);
  assert.equal(out.results[0]!.title, "Add the retry policy");
  const scribe = calls.at(-1)!;
  assert.equal(scribe.opts.label, "Trace scribe: w2-d1 trace lines");
  assert.match(scribe.prompt, /Append the 2 line\(s\)/);
  assert.match(scribe.prompt, /to the file \/scratch\/t\/trace\/w2-d1\.jsonl/);
  assert.match(scribe.prompt, /<<<TRACE\n\{.*\nTRACE>>>/s);
  assert.deepEqual(out.results[0]!.scribe, { appended: 2, totalLines: 99 });
});

test("trace files: one per dispatch id under <scratch>/trace, so parallel workflows never write the same file", () => {
  assert.equal(traceFileOf("/s/", "w1-d2"), "/s/trace/w1-d2.jsonl");
  assert.equal(traceFileOf("/s", "w 1/../x"), "/s/trace/w_1_.._x.jsonl");
});

test("args without a dispatch spec return failed, and the scribe still records it", async () => {
  const f = fakeRuntime();
  const out = await runWorkflow({ ...baseArgs } as never, f.rt);
  assert.equal(out.status, "failed");
  assert.match(out.result, /not a dispatch spec/);
  assert.deepEqual(f.roles(), ["Trace scribe"]);
  assert.equal(eventsOf(f.calls[0]!.prompt).length, 1);
});

test("a scribe that returns nothing is logged and the workflow still returns its result", async () => {
  const { out, logs } = await wave([spec({ id: "w1-d1", topology: "single" })], { scribe: null });
  assert.equal(out.results[0]!.status, "done");
  assert.equal(out.results[0]!.scribe, null);
  assert.ok(logs.some((l) => /w1-d1: scribe returned nothing/.test(l)));
});

test("malformed humans entries are dropped and logged up front; the result and the well-formed interventions survive", async () => {
  const { out, calls, logs } = await wave([spec({ id: "w2-d1", topology: "single" })], {}, {
    humans: [null, "not an object", 42, { type: "human", trigger: "ambiguity", question: "Which DB?", answer: "postgres" }],
  });
  assert.equal(out.results[0]!.status, "done");
  assert.deepEqual(
    out.events.map((e) => e.type),
    ["human", "dispatch"],
  );
  assert.equal((out.events[0] as { at?: string }).at, baseArgs.now);
  assert.ok(logs.some((l) => /w2-d1: dropped 3 malformed humans entr/.test(l)), `logged the drop: ${logs.join(" | ")}`);
  assert.match(calls.at(-1)!.prompt, /Append the 2 line\(s\)/);
});

test("a scribe that throws is logged and the workflow still returns its result", async () => {
  const { out, logs } = await wave([spec({ id: "w1-d1", topology: "single" })], {
    scribe: () => {
      throw new Error("disk full");
    },
  });
  assert.equal(out.results[0]!.status, "done");
  assert.equal(out.results[0]!.scribe, null);
  assert.ok(logs.some((l) => /scribe threw: disk full/.test(l)));
});
