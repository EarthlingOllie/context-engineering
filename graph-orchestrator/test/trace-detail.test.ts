// B-06: verdict, chain and truncation detail in trace lines; interventions carry `source`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTrace } from "../src/trace/render.ts";
import { spec, wave } from "./helpers.ts";

type Line = Record<string, unknown> & { type: string; id?: string; parent?: string };
const dispatchLine = (events: unknown[], id: string) => (events as Line[]).find((e) => e.type === "dispatch" && e.id === id)!;

// ---------- dispatch seam ----------

test("B-06: a generator-evaluator line records the pass criteria once and each round's verdict with its first feedback line", async () => {
  const { out } = await wave(
    [spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 3, pass_criteria: "1. tests pass\n2. no lint errors" } })],
    {
      Generator: { result: "attempt", artifacts: [], blocked: false },
      "Evaluator (1": { pass: false, feedback: "1. missing null check at a.js:3\n2. lint: unused var", blocked: false },
      "Evaluator (2": { pass: true, feedback: "", blocked: false },
    },
  );
  const d = dispatchLine(out.events, "w1-d1");
  assert.equal(d["criteria"], "1. tests pass\n2. no lint errors");
  assert.deepEqual(d["rounds"], [
    { round: 1, verdict: "fail", feedback: "1. missing null check at a.js:3" },
    { round: 2, verdict: "pass" },
  ]);
});

test("B-06: a blocked evaluator round is recorded as blocked with its question's first line", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "generator-evaluator", params: { pass_criteria: "x" } })], {
    Generator: { result: "attempt", artifacts: [], blocked: false },
    Evaluator: { pass: false, feedback: "", blocked: true, question: "Is the legacy API in scope?\nIt is not in the spec." },
  });
  assert.deepEqual(dispatchLine(out.events, "w1-d1")["rounds"], [{ round: 1, verdict: "blocked", feedback: "Is the legacy API in scope?" }]);
});

test("B-06: an iterative-fan-out line records its coverage criteria and each evaluator round's verdict", async () => {
  const { out } = await wave(
    [spec({ id: "w1-d1", topology: "iterative-fan-out", params: { split: ["a", "b"], coverage_criteria: "every module covered", max_rounds: 2 } })],
    { "Evaluator (1": { pass: false, feedback: "1. module c\n2. module d", blocked: false }, "Evaluator (2": { pass: true, feedback: "", blocked: false } },
  );
  const d = dispatchLine(out.events, "w1-d1");
  assert.equal(d["criteria"], "every module covered");
  assert.deepEqual(d["rounds"], [
    { round: 1, verdict: "fail", feedback: "1. module c" },
    { round: 2, verdict: "pass" },
  ]);
});

test("B-06: a chain line carries each stage's first line; a generator-evaluator stage's own line carries its rounds, the chain line does not", async () => {
  const { out } = await wave(
    [
      spec({
        id: "w3-d1",
        topology: "chain",
        params: {
          stages: [
            { id: "w3-s1", topology: "single", task: "research" },
            { id: "w3-s2", topology: "generator-evaluator", task: "write it up", params: { max_iterations: 2, pass_criteria: "reads well" } },
          ],
        },
      }),
    ],
    {
      "Link 1 · Single, Worker": { result: "/scratch/t/research.md\nthree findings", artifacts: [], blocked: false },
      Generator: { result: "/scratch/t/writeup.md", artifacts: [], blocked: false },
    },
  );
  const chain = dispatchLine(out.events, "w3-d1");
  assert.deepEqual(chain["stageLines"], ["w3-s1 done: /scratch/t/research.md", "w3-s2 done: /scratch/t/writeup.md"]);
  assert.equal(chain["rounds"], undefined);
  assert.equal(chain["criteria"], undefined);
  const stage = dispatchLine(out.events, "w3-s2");
  assert.equal(stage["parent"], "w3-d1");
  assert.equal(stage["criteria"], "reads well");
  assert.deepEqual(stage["rounds"], [{ round: 1, verdict: "pass" }]);
});

test("B-06: a cut that drops lines logs how many, and the dispatch line records the count", async () => {
  // Each round the generator's 5 lines are cut to 3 (2 dropped, twice); the exhausted head keeps 2 of those 3 (1 dropped).
  const { out, logs } = await wave(
    [spec({ id: "w1-d1", topology: "generator-evaluator", params: { max_iterations: 2, pass_criteria: "x" }, returns: { shape: "x", maxLines: 3 } })],
    { Generator: { result: "l1\nl2\nl3\nl4\nl5", artifacts: [], blocked: false }, Evaluator: { pass: false, feedback: "still wrong", blocked: false } },
  );
  assert.equal(out.results[0]!.result, "l1\nl2\n-- exhausted after 2 round(s); last evaluator feedback: still wrong");
  assert.equal(dispatchLine(out.events, "w1-d1")["dropped"], 5);
  assert.ok(logs.includes("w1-d1: cuts dropped 5 line(s)"), logs.join("\n"));
});

test("B-06: a chain stage's line records only the lines its own cuts dropped", async () => {
  const { out } = await wave(
    [
      spec({
        id: "w3-d1",
        topology: "chain",
        returns: { shape: "x", maxLines: 20 },
        params: { stages: [{ id: "w3-s1", topology: "single", task: "a", returns: { shape: "x", maxLines: 2 } }, { id: "w3-s2", topology: "single", task: "b" }] },
      }),
    ],
    { "Link 1 · Single, Worker": { result: "1\n2\n3\n4", artifacts: [], blocked: false }, "Link 2 · Single, Worker": { result: "only", artifacts: [], blocked: false } },
  );
  assert.equal(dispatchLine(out.events, "w3-s1")["dropped"], 2);
  assert.equal(dispatchLine(out.events, "w3-s2")["dropped"], undefined);
  assert.equal(dispatchLine(out.events, "w3-d1")["dropped"], 2, "the chain line counts every cut under it");
});

test("B-06: a dispatch whose cuts dropped nothing has no dropped field and logs no cut", async () => {
  const { out, logs } = await wave([spec({ id: "w1-d1", topology: "generator-evaluator", params: { pass_criteria: "x" } })]);
  assert.equal(dispatchLine(out.events, "w1-d1")["dropped"], undefined);
  assert.ok(!logs.some((l) => l.includes("cuts dropped")));
});

test("B-06: a single's dropped lines are logged even when its worker wrote the trace line itself", async () => {
  const { out, logs, roles } = await wave([spec({ id: "w1-d1", topology: "single", returns: { shape: "x", maxLines: 1 } })], {
    Worker: { result: "a\nb\nc", artifacts: [], blocked: false, traceAppended: 1, traceTotalLines: 1 },
  });
  assert.equal(out.results[0]!.result, "a");
  assert.ok(logs.includes("w1-d1: cuts dropped 2 line(s)"), logs.join("\n"));
  assert.deepEqual(roles(), ["Worker"], "the worker's own line stands; no scribe re-writes it");
});

test("B-06: interventions carry source: an explicit source is kept, else autonomous gives self and attended gives human", async () => {
  const { out } = await wave([spec({ id: "w2-d1", topology: "single" })], {}, {
    humans: [
      { trigger: "blocked", question: "q1", answer: "a1", mode: "autonomous" },
      { trigger: "blocked", question: "q2", answer: "a2", mode: "attended" },
      { trigger: "blocked", question: "q3", answer: "a3", mode: "autonomous", source: "human" },
      { trigger: "blocked", question: "q4", answer: "a4" },
      { trigger: "blocked", question: "q5", answer: "a5", source: "user" },
    ],
  });
  const sources = (out.events as Line[]).filter((e) => e.type === "human").map((e) => e["source"]);
  assert.deepEqual(sources, ["self", "human", "human", undefined, undefined], "an unknown source value is dropped, not guessed");
});

// ---------- render seam ----------

test("B-06: the renderer draws an intervention by its source, over the mode", () => {
  const out = renderTrace("", [
    { type: "human", trigger: "blocked", question: "A?", answer: "x", mode: "attended", source: "self" },
    { type: "human", trigger: "blocked", question: "B?", answer: "y", mode: "autonomous", source: "human" },
  ] as never);
  const L = out.split("\n").map((l) => l.trim());
  assert.ok(L.includes('human_1(["self · blocked<br/>A?<br/>→ x"]):::self'), out);
  assert.ok(L.includes('human_2(["human · blocked<br/>B?<br/>→ y"]):::human'), out);
});

test("B-06: a trace line without source falls back to the mode; a source in the JSONL text is read", () => {
  const text = [
    JSON.stringify({ type: "human", trigger: "budget", question: "Go on?", answer: "stop", mode: "autonomous" }),
    JSON.stringify({ type: "human", trigger: "budget", question: "Again?", answer: "go", mode: "autonomous", source: "human" }),
    JSON.stringify({ type: "dispatch", wave: 1, id: "w1-d1", topology: "generator-evaluator", iterations: 1, status: "done", dependsOn: [], criteria: "x", rounds: [{ round: 1, verdict: "pass" }], dropped: 3 }),
  ].join("\n");
  const L = renderTrace(text).split("\n").map((l) => l.trim());
  assert.ok(L.includes('human_1(["self · budget<br/>Go on?<br/>→ stop"]):::self'));
  assert.ok(L.includes('human_2(["human · budget<br/>Again?<br/>→ go"]):::human'));
  assert.ok(L.some((l) => l.startsWith("w1_d1") || l.includes("w1-d1")), "the dispatch with the new fields still renders");
});
