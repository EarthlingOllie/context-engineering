import { test } from "node:test";
import assert from "node:assert/strict";
import { runWave } from "../src/wave.ts";
import { agentDemand } from "../src/topologies.ts";
import type { DispatchSpec } from "../src/types.ts";
import { baseArgs, fakeRuntime, spec } from "./helpers.ts";

const wave = (dispatches: DispatchSpec[], script = {}, extra: Record<string, unknown> = {}) => {
  const f = fakeRuntime(script);
  return runWave({ ...baseArgs, dispatches, ...extra }, f.rt).then((out) => ({ out, ...f }));
};

// ---------- single ----------

test("single: one worker call, one done result, prompt carries stance, context, skill, instructions and contract", async () => {
  const { out, calls, labels } = await wave(
    [spec({ id: "w1-d1", topology: "single", task: "Write the leap-year helper", context: ["tests live in test/", "use node:test"], roles: { worker: { skill: "tdd", instructions: "red first" } } })],
    { worker: { result: "/scratch/t/leap.js\nexports isLeap", artifacts: ["/scratch/t/leap.js"], blocked: false } },
  );
  assert.deepEqual(labels(), ["w1-d1 worker", "wave 1 scribe"]);
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
  assert.equal(calls[0]!.opts.phase, "w1-d1");
  assert.ok(calls[0]!.opts.schema, "worker call carries the role schema");
});

test("single: blocked output short-circuits to a blocked result with the question", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "single" })], { worker: { result: "", artifacts: [], blocked: true, question: "Which database?" } });
  assert.equal(out.results[0]!.status, "blocked");
  assert.equal(out.results[0]!.question, "Which database?");
  const ev = out.events.find((e) => e.type === "dispatch")!;
  assert.equal((ev as { question?: string }).question, "Which database?");
});

// ---------- generator-evaluator ----------

test("generator-evaluator: stops on first pass; round 2 generator sees feedback but not its own previous output", async () => {
  const { out, calls, labels } = await wave(
    [spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 3, pass_criteria: "tests pass" }, roles: { generator: { instructions: "gen" }, evaluator: { skill: "code-review", instructions: "eval" } } })],
    {
      "generator r1": { result: "FIRST-ATTEMPT-TEXT", artifacts: ["/scratch/t/a.js"], blocked: false },
      "generator r2": { result: "second attempt", artifacts: ["/scratch/t/a.js"], blocked: false },
      "evaluator r1": { pass: false, feedback: "1. missing null check at a.js:3", blocked: false },
      "evaluator r2": { pass: true, feedback: "", blocked: false },
    },
  );
  assert.deepEqual(labels(), ["w1-d1 generator r1", "w1-d1 evaluator r1", "w1-d1 generator r2", "w1-d1 evaluator r2", "wave 1 scribe"]);
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
  const { out, labels } = await wave(
    [spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 2, pass_criteria: "x" }, returns: { shape: "x", maxLines: 3 } })],
    { generator: { result: "l1\nl2\nl3", artifacts: [], blocked: false }, evaluator: { pass: false, feedback: "still wrong\nmore detail", blocked: false } },
  );
  assert.equal(labels().length, 5);
  const r = out.results[0]!;
  assert.equal(r.status, "exhausted");
  assert.equal(r.iterations, 2);
  assert.equal(r.result, "l1\nl2\n-- exhausted after 2 round(s); last evaluator feedback: still wrong");
  assert.equal(r.result.split("\n").length, 3);
});

test("generator-evaluator: defaults to 3 iterations and short-circuits when the evaluator is blocked", async () => {
  const { out, labels } = await wave(
    [spec({ id: "w1-d1", topology: "generator-evaluator", params: { pass_criteria: "x" } })],
    { generator: { result: "attempt", artifacts: [], blocked: false }, "evaluator r1": { pass: false, feedback: "", blocked: true, question: "Is the legacy API in scope?" } },
  );
  assert.deepEqual(labels(), ["w1-d1 generator r1", "w1-d1 evaluator r1", "wave 1 scribe"]);
  assert.equal(out.results[0]!.status, "blocked");
  assert.equal(out.results[0]!.question, "Is the legacy API in scope?");
  assert.equal(out.results[0]!.iterations, 1);
  assert.equal(agentDemand(spec({ id: "x", topology: "generator-evaluator" })), 6);
});

// ---------- fan-out ----------

test("fan-out: explicit split runs one branch per sub-task in parallel and concatenates without a reducer", async () => {
  const { out, calls, labels } = await wave(
    [spec({ id: "w1-d1", topology: "fan-out", task: "Survey the three modules", params: { split: ["module a", "module b", "module c"] }, returns: { shape: "a line per module", maxLines: 6 } })],
    { "branch 1/3": { result: "a: fine", artifacts: ["/scratch/t/a.md"], blocked: false }, "branch 2/3": { result: "b: fine", artifacts: [], blocked: false }, "branch 3/3": { result: "c: fine", artifacts: [], blocked: false } },
  );
  assert.deepEqual(labels(), ["w1-d1 branch 1/3", "w1-d1 branch 2/3", "w1-d1 branch 3/3", "wave 1 scribe"]);
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, "[1] a: fine\n[2] b: fine\n[3] c: fine");
  assert.deepEqual(r.artifacts, ["/scratch/t/a.md"]);
  assert.match(calls[1]!.prompt, /TASK: module b/);
  assert.match(calls[1]!.prompt, /branch 2 of 3 of a fan-out whose parent task is: Survey the three modules/);
  assert.match(calls[1]!.prompt, /RETURN: at most 2 lines/);
});

test("fan-out: a split wider than 9 returns over_budget without spending agents", async () => {
  const { out, labels } = await wave([spec({ id: "w1-d1", topology: "fan-out", params: { split: Array.from({ length: 10 }, (_, i) => `part ${i}`) } })]);
  assert.deepEqual(labels(), ["wave 1 scribe"]);
  assert.equal(out.results[0]!.status, "over_budget");
  assert.match(out.results[0]!.result, /width cap of 9/);
});

test("fan-out: the reducer runs over finished branches and a blocked branch blocks only itself", async () => {
  const { out, calls } = await wave(
    [spec({ id: "w1-d1", topology: "fan-out", params: { split: ["x", "y", "z"] }, roles: { reducer: { instructions: "merge by theme" } } })],
    {
      "branch 1/3": { result: "x done", artifacts: [], blocked: false },
      "branch 2/3": { result: "", artifacts: [], blocked: true, question: "Need prod credentials for y" },
      "branch 3/3": { result: "z done", artifacts: ["/scratch/t/z.md"], blocked: false },
      reducer: { result: "merged x and z; y missing", artifacts: ["/scratch/t/merged.md"], blocked: false },
    },
  );
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, "merged x and z; y missing");
  assert.match(r.question!, /branch 2 \(y\): Need prod credentials for y/);
  assert.deepEqual(r.artifacts, ["/scratch/t/z.md", "/scratch/t/merged.md"]);
  const red = calls.find((c) => c.opts.label === "w1-d1 reducer")!.prompt;
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
      "branch 1/2": { result: "x done", artifacts: ["/scratch/t/x.md"], blocked: false },
      "branch 2/2": { result: "", artifacts: [], blocked: true, question: "Need prod credentials for y" },
      reducer: { result: "partial merge", artifacts: [], blocked: true, question: "Merge x alone, or wait for y?" },
    },
  );
  const r = out.results[0]!;
  assert.equal(r.status, "blocked");
  assert.equal(r.result, "partial merge");
  assert.deepEqual(r.artifacts, ["/scratch/t/x.md"]);
  assert.match(r.question!, /^Merge x alone, or wait for y\?\nbranch 2 \(y\): Need prod credentials for y$/, "the reducer's question first, then the gaps");
});

test("fan-out: all branches blocked makes the dispatch blocked", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "fan-out", params: { split: ["x", "y"] } })], { branch: { result: "", artifacts: [], blocked: true, question: "who owns this?" } });
  assert.equal(out.results[0]!.status, "blocked");
  assert.match(out.results[0]!.question!, /branch 1 \(x\): who owns this\?\nbranch 2 \(y\): who owns this\?/);
});

test("fan-out: a partition instruction runs a partition agent first, then at most `width` branches", async () => {
  const { out, calls, labels } = await wave(
    [spec({ id: "w1-d1", topology: "fan-out", params: { width: 2, split: "split by package" } })],
    { partition: { subtasks: ["pkg a", "pkg b", "pkg c"], blocked: false } },
  );
  assert.deepEqual(labels(), ["w1-d1 partition", "w1-d1 branch 1/2", "w1-d1 branch 2/2", "wave 1 scribe"]);
  assert.match(calls[0]!.prompt, /PARTITION INSTRUCTION:\nsplit by package/);
  assert.match(calls[0]!.prompt, /at most 2 independent sub-tasks/);
  assert.match(calls[1]!.prompt, /TASK: pkg a/);
  assert.equal(out.results[0]!.status, "done");
  assert.equal(agentDemand(spec({ id: "x", topology: "fan-out", params: { width: 2, split: "s", reducer: true } })), 4);
});

// ---------- debate ----------

test("debate: not built in this version; returns failed without spending agents, over_budget above 6 participants", async () => {
  const { out, labels } = await wave([
    spec({ id: "w1-d1", topology: "debate", params: { participants: [{ name: "a", stance: "for" }, { name: "b", stance: "against" }], judge: { instructions: "decide" } } }),
    spec({ id: "w1-d2", topology: "debate", params: { participants: Array.from({ length: 7 }, (_, i) => ({ name: `p${i}`, stance: "s" })) } }),
  ]);
  assert.deepEqual(labels(), ["wave 1 scribe"]);
  assert.equal(out.results[0]!.status, "failed");
  assert.match(out.results[0]!.result, /dogfood task/);
  assert.equal(out.results[1]!.status, "over_budget");
  assert.equal(agentDemand(spec({ id: "x", topology: "debate", params: { participants: [{}, {}, {}], rounds: 2 } })), 7);
});

// ---------- chain ----------

test("chain: runs stages in order, forwards artifacts, records stage statuses and stage trace lines", async () => {
  const { out, calls, labels } = await wave(
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
      "w3-s1 worker": { result: "/scratch/t/research.md\nthree findings", artifacts: ["/scratch/t/research.md"], blocked: false },
      generator: { result: "/scratch/t/writeup.md", artifacts: ["/scratch/t/writeup.md"], blocked: false },
    },
  );
  assert.deepEqual(labels(), ["w3-s1 worker", "w3-s2 generator r1", "w3-s2 evaluator r1", "wave 3 scribe"]);
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
  assert.deepEqual(types, ["wave_start", "w3-s1<w3-d1", "w3-s2<w3-d1", "w3-d1", "wave_end"]);
  const chainEv = out.events.find((e) => e.type === "dispatch" && e.id === "w3-d1") as { stages?: string[] };
  assert.deepEqual(chainEv.stages, ["w3-s1:done", "w3-s2:done"]);
});

test("chain: stops at the first stage that is not done and carries its status and question", async () => {
  const { out, labels } = await wave(
    [spec({ id: "w1-d1", topology: "chain", params: { stages: [{ topology: "single", task: "a" }, { topology: "single", task: "b" }] } })],
    { "w1-d1-s1 worker": { result: "", artifacts: [], blocked: true, question: "Which region?" } },
  );
  assert.deepEqual(labels(), ["w1-d1-s1 worker", "wave 1 scribe"]);
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
    { worker: { result: six, artifacts: [], blocked: false } },
  );
  assert.equal(out.results[0]!.result, "1\n2\n3");
  assert.equal(out.results[1]!.result, six);
  assert.match(calls[1]!.prompt, /RETURN: at most 20 lines/);
});

test("malformed specs: unknown topology, missing id, missing task and non-object all return failed rather than throwing", async () => {
  const { out, labels } = await wave([
    { ...spec({ id: "w1-d1", topology: "single" }), topology: "tournament" as never },
    { ...spec({ id: "", topology: "single" }) },
    spec({ id: "w1-d3", topology: "single", task: "" }),
    null as never,
  ]);
  assert.deepEqual(labels(), ["wave 1 scribe"]);
  assert.deepEqual(
    out.results.map((r) => r.status),
    ["failed", "failed", "failed", "failed"],
  );
  assert.match(out.results[0]!.result, /unknown topology "tournament"/);
  assert.equal(out.events.filter((e) => e.type === "dispatch").length, 4);
});

test("an agent that throws yields a failed result for that dispatch and the wave still returns", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "single" }), spec({ id: "w1-d2", topology: "single" })], {
    "w1-d1 worker": () => {
      throw new Error("boom");
    },
  });
  assert.equal(out.results[0]!.status, "failed");
  assert.match(out.results[0]!.result, /boom/);
  assert.equal(out.results[1]!.status, "done");
  assert.equal(out.scribe?.appended, 4);
});

// ---------- demand logging and budgets ----------

test("demand log: the logged demand is the sum of each dispatch's agent need, with the scribe stated apart, against the cap", async () => {
  const dispatches = [
    spec({ id: "w2-d1", topology: "single" }),
    spec({ id: "w2-d2", topology: "generator-evaluator", params: { max_iterations: 3 } }),
    spec({ id: "w2-d3", topology: "fan-out", params: { split: ["a", "b", "c", "d"] }, roles: { reducer: { instructions: "" } } }),
    spec({ id: "w2-d4", topology: "chain", params: { stages: [{ topology: "single", task: "a" }, { topology: "single", task: "b" }] } }),
  ];
  const { out, logs } = await wave(dispatches, {}, { maxAgents: 2 });
  assert.equal(out.demand, 1 + 6 + 5 + 2);
  assert.equal(out.cap, 2);
  assert.equal(out.wave, 2);
  assert.match(logs[0]!, /^wave 2: 4 dispatch\(es\), demand 14 agent\(s\) \+ 1 scribe vs cap 2 — over cap/);
  assert.match(logs[0]!, /w2-d1=1 w2-d2=6 w2-d3=5 w2-d4=2/);
  const start = out.events[0] as { demand: number; cap: number };
  assert.equal(start.demand, 14);
  assert.equal(start.cap, 2);
});

test("hard limit: dispatches beyond the 1000-agent run limit return over_budget unrun", async () => {
  const big = Array.from({ length: 120 }, (_, i) => spec({ id: `w1-d${i + 1}`, topology: "generator-evaluator", params: { max_iterations: 5 } })); // 10 agents each
  const { out, labels } = await wave(big);
  const statuses = out.results.map((r) => r.status);
  assert.equal(statuses.filter((s) => s === "done").length, 99); // 1 + 99*10 = 991 ≤ 1000; the 100th would make 1001
  assert.equal(statuses.filter((s) => s === "over_budget").length, 21);
  assert.equal(labels().filter((l) => l.includes("generator")).length, 99);
});

// ---------- same-wave dependencies, humans, scribe ----------

test("same-wave dependsOn: the dependant waits for its dependency and receives the artifacts; cycles and duplicate ids fail", async () => {
  const order: string[] = [];
  const { out, calls } = await wave(
    [
      spec({ id: "w1-d2", topology: "single", dependsOn: ["w1-d1", "w0-d9"] }),
      spec({ id: "w1-d1", topology: "single" }),
      spec({ id: "w1-d3", topology: "single", dependsOn: ["w1-d4"] }),
      spec({ id: "w1-d4", topology: "single", dependsOn: ["w1-d3"] }),
      spec({ id: "w1-d1", topology: "single" }),
    ],
    {
      worker: (c: { opts: { label?: string } }) => {
        order.push(c.opts.label ?? "");
        return { result: "r", artifacts: [`/scratch/t/${(c.opts.label ?? "").split(" ")[0]}.md`], blocked: false };
      },
    },
  );
  assert.deepEqual(order, ["w1-d1 worker", "w1-d2 worker"]);
  assert.match(calls.find((c) => c.opts.label === "w1-d2 worker")!.prompt, /- w1-d1 \(done\) returned: r\n- artifacts from w1-d1: \/scratch\/t\/w1-d1\.md/);
  assert.deepEqual(
    out.results.map((r) => r.status),
    ["done", "done", "failed", "failed", "failed"],
  );
  assert.match(out.results[2]!.result, /cycle/);
  assert.match(out.results[4]!.result, /duplicate dispatch id/);
});

test("same-wave dependsOn: a dependant whose dependency did not finish done is short-circuited as failed, spending no agent", async () => {
  const { out, labels, logs } = await wave(
    [
      spec({ id: "w1-d1", topology: "single" }),
      spec({ id: "w1-d2", topology: "single", dependsOn: ["w1-d1"] }),
      spec({ id: "w1-d3", topology: "single", dependsOn: ["w1-d2"] }),
    ],
    { "w1-d1 worker": { result: "need a decision", artifacts: [], blocked: true, question: "Which DB?" } },
  );
  assert.deepEqual(labels(), ["w1-d1 worker", "wave 1 scribe"], "neither dependant runs a worker");
  assert.deepEqual(
    out.results.map((r) => [r.id, r.status, r.iterations]),
    [
      ["w1-d1", "blocked", 1],
      ["w1-d2", "failed", 0],
      ["w1-d3", "failed", 0],
    ],
  );
  assert.match(out.results[1]!.result, /^dependency w1-d1 was blocked/);
  assert.match(out.results[2]!.result, /^dependency w1-d2 was failed/);
  assert.ok(logs.some((l) => /w1-d2: dependency w1-d1 was blocked/.test(l)), "the short-circuit is logged");
});

test("humans passed in args are written by the scribe before the wave, stamped with now when undated", async () => {
  const { out, calls } = await wave([spec({ id: "w2-d1", topology: "single", dependsOn: ["w1-d2"] })], {}, {
    humans: [{ type: "human", trigger: "blocked", dispatch: "w1-d2", question: "Which DB?", answer: "postgres", mode: "attended" }],
  });
  const first = out.events[0] as { type: string; at?: string; answer?: string };
  assert.equal(first.type, "human");
  assert.equal(first.at, baseArgs.now);
  assert.equal(first.answer, "postgres");
  assert.equal(out.events[1]!.type, "wave_start");
  const scribe = calls.at(-1)!;
  assert.equal(scribe.opts.label, "wave 2 scribe");
  assert.match(scribe.prompt, /Append the 4 line\(s\)/);
  assert.match(scribe.prompt, /to the file \/scratch\/t\/trace\.jsonl/);
  for (const e of out.events) assert.ok(scribe.prompt.includes(JSON.stringify(e)), `scribe prompt carries ${e.type}`);
  assert.match(scribe.prompt, /<<<TRACE\n\{.*\nTRACE>>>/s);
  assert.deepEqual(out.scribe, { appended: 4, totalLines: 99 });
});

test("a wave with no dispatches still logs, writes wave_start and wave_end, and returns", async () => {
  const { out, logs } = await wave([], {}, { wave: 7, maxAgents: 0 });
  assert.equal(out.wave, 7);
  assert.equal(out.cap, 1);
  assert.deepEqual(out.results, []);
  assert.deepEqual(
    out.events.map((e) => e.type),
    ["wave_start", "wave_end"],
  );
  assert.match(logs[0]!, /wave 7: 0 dispatch\(es\), demand 0 agent\(s\) \+ 1 scribe/);
});

test("a scribe that returns nothing is logged and the wave still returns its results and events", async () => {
  const { out, logs } = await wave([spec({ id: "w1-d1", topology: "single" })], { scribe: null });
  assert.equal(out.results[0]!.status, "done");
  assert.equal(out.scribe, null);
  assert.ok(logs.some((l) => /scribe returned nothing/.test(l)));
});
