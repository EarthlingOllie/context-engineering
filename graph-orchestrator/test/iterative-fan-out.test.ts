// iterative-fan-out: the topology's own tests (design-specs.md, iterative-fan-out).
import { test } from "node:test";
import assert from "node:assert/strict";
import { agentDemand } from "../src/topologies.ts";
import { spec, wave } from "./helpers.ts";

const fail = (feedback: string) => ({ pass: false, feedback, blocked: false });
const pass = { pass: true, feedback: "", blocked: false };
const work = (result: string, artifacts: string[] = []) => ({ result, artifacts, blocked: false });
/** Labels with the task excerpt dropped: these tests check which agents ran, not their excerpts. */
const withoutExcerpt = (labels: string[]) => labels.map((l) => l.replace(/ — .*$/, ""));
const blocked = (question: string) => ({ result: "", artifacts: [], blocked: true, question });
const ifo = (id: string, params: Record<string, unknown>, roles: Record<string, unknown> = {}) =>
  spec({ id, topology: "iterative-fan-out", task: "map trace file access", params: { coverage_criteria: "every import covered", ...params }, roles: roles as never });

test("iterative-fan-out pass: round 1 branches, evaluator passes, reducer merges; done in 1 round", async () => {
  const { out, labels, calls } = await wave([ifo("w1-d1", { split: ["scan src/a", "scan src/b"] }, { worker: { instructions: "cite file:line" }, reducer: { instructions: "group by module" } })], {
    "Branch 1 of 2 · round 1": work("a.ts:3 reads trace\nmore", ["/s/a.md"]),
    "Branch 2 of 2 · round 1": work("b.ts:9 writes trace", ["/s/b.md"]),
    "Evaluator · round 1": pass,
    Reducer: work("2 call sites", ["/s/merged.md"]),
  });
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.iterations, 1);
  assert.equal(r.result, "2 call sites");
  assert.deepEqual(r.artifacts, ["/s/a.md", "/s/b.md", "/s/merged.md"]);
  assert.equal(r.question, undefined);
  assert.deepEqual(withoutExcerpt(labels()), ["Branch 1 of 2 · round 1", "Branch 2 of 2 · round 1", "Evaluator · round 1", "Reducer", "Trace scribe"]);
  assert.ok(calls.every((c) => c.opts.phase === undefined), "agents carry no phase: the workflow is the dispatch");
  assert.match(calls[0]!.prompt, /TASK: scan src\/a/);
  assert.match(calls[0]!.prompt, /cite file:line/);

  const ev = calls[2]!.prompt;
  assert.match(ev, /ROLE: evaluator/);
  assert.match(ev, /COVERAGE CRITERIA:\nevery import covered/);
  assert.match(ev, /FINDINGS SO FAR:/);
  assert.match(ev, /scan src\/a.*\n.*a\.ts:3 reads trace/);
  assert.doesNotMatch(ev, /more/);
  assert.match(ev, /\/s\/a\.md/);

  const red = calls[3]!.prompt;
  assert.match(red, /ROLE: reducer/);
  assert.match(red, /group by module/);
  assert.match(red, /BRANCH RESULTS:/);
  assert.match(red, /a\.ts:3 reads trace\nmore/);
  assert.doesNotMatch(red, /OPEN GAPS/);
});

test("iterative-fan-out gaps: failing feedback becomes the next split, numbering stripped, deduped against run sub-tasks, cut to width", async () => {
  const { out, labels, calls, logs } = await wave([ifo("w1-d1", { split: ["scan src/a", "scan src/b"] })], {
    "Evaluator · round 1": fail("1. cover src/c\n2) Scan  SRC/a\n- cover src/d\n3. cover src/c\n4. cover src/e"),
    "Evaluator · round 2": pass,
    "Branch 1 of 2 · round 2": work("c.ts:1 imports trace", ["/s/c.md"]),
  });
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.iterations, 2);
  assert.deepEqual(withoutExcerpt(labels()), [
    "Branch 1 of 2 · round 1", "Branch 2 of 2 · round 1", "Evaluator · round 1",
    "Branch 1 of 2 · round 2", "Branch 2 of 2 · round 2", "Evaluator · round 2",
    "Reducer", "Trace scribe",
  ]);
  assert.match(calls[3]!.prompt, /TASK: cover src\/c\n/);
  assert.match(calls[4]!.prompt, /TASK: cover src\/d\n/);
  assert.match(calls[3]!.prompt, /round 2 of 2/);
  assert.ok(logs.some((l) => /cover src\/e/.test(l)), "the truncated extra is logged");
  // Round-2 evaluator and reducer see findings from both rounds.
  assert.match(calls[5]!.prompt, /ok: Branch 1 of 2 · round 1 — scan src\/a/);
  assert.match(calls[5]!.prompt, /c\.ts:1 imports trace/);
  assert.match(calls[6]!.prompt, /round 1[\s\S]*round 2/);
  assert.ok(r.artifacts.includes("/s/c.md"));
});

test("iterative-fan-out stall: feedback with nothing new ends as exhausted before max_rounds, reducer gets OPEN GAPS", async () => {
  const { out, labels, calls } = await wave([ifo("w1-d1", { split: ["scan src/a"], max_rounds: 3 })], {
    "Evaluator · round 1": fail("1. scan src/a\n2. Scan src/a"),
    Reducer: work("partial map\nline two\nline three"),
  });
  const r = out.results[0]!;
  assert.equal(r.status, "exhausted");
  assert.equal(r.iterations, 1);
  assert.deepEqual(withoutExcerpt(labels()), ["Branch 1 of 1 · round 1", "Evaluator · round 1", "Reducer", "Trace scribe"]);
  assert.match(calls[2]!.prompt, /OPEN GAPS:\n.*scan src\/a/);
  assert.equal(r.result, "partial map\nline two\nline three\n-- exhausted after 1 round(s); open gaps: 1; first: scan src/a");
});

test("iterative-fan-out cap: max_rounds used up ends as exhausted; the evaluator still judges the last round; tail fits maxLines", async () => {
  const { out, labels } = await wave([ifo("w1-d1", { split: ["scan src/a"], max_rounds: 2 })], {
    "Evaluator · round 1": fail("1. cover src/b"),
    "Evaluator · round 2": fail("1. cover src/c\n2. cover src/d"),
    Reducer: work("l1\nl2\nl3\nl4\nl5"),
  });
  const r = out.results[0]!;
  assert.equal(r.status, "exhausted");
  assert.equal(r.iterations, 2);
  assert.deepEqual(withoutExcerpt(labels()), ["Branch 1 of 1 · round 1", "Evaluator · round 1", "Branch 1 of 1 · round 2", "Evaluator · round 2", "Reducer", "Trace scribe"]);
  assert.equal(r.result, "l1\nl2\nl3\nl4\n-- exhausted after 2 round(s); open gaps: 2; first: cover src/c");
});

test("iterative-fan-out caps and malformed params: over_budget or failed, no agent spent", async () => {
  const { out, labels } = await wave([
    ifo("w1-d1", { split: "by dir", width: 10 }),
    ifo("w1-d2", { split: Array.from({ length: 10 }, (_, i) => `t${i}`) }),
    ifo("w1-d3", { split: ["a"], max_rounds: 4 }),
    spec({ id: "w1-d4", topology: "iterative-fan-out", params: { split: ["a"] } }),
    ifo("w1-d5", { split: [] }),
  ]);
  assert.deepEqual(labels().filter((l) => l !== "Trace scribe"), [], "no role agent runs");
  assert.deepEqual(out.results.map((r) => r.status), ["over_budget", "over_budget", "over_budget", "failed", "failed"]);
  assert.match(out.results[0]!.result, /cap of 9/);
  assert.match(out.results[1]!.result, /cap of 9/);
  assert.match(out.results[2]!.result, /cap of 3/);
  assert.match(out.results[3]!.result, /coverage_criteria/);
});

test("iterative-fan-out blocked branch: a gap that travels in question; the run continues and the evaluator sees it", async () => {
  const { out, calls } = await wave([ifo("w1-d1", { split: ["scan src/a", "scan src/b"] })], {
    "Branch 2 of 2 · round 1": blocked("which repo holds src/b?"),
  });
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.match(r.question ?? "", /round 1 branch 2 \(scan src\/b\): which repo holds src\/b\?/);
  assert.match(calls[2]!.prompt, /GAP: which repo holds src\/b\?/);
  assert.match(calls[3]!.prompt, /GAP: which repo holds src\/b\?/);
});

test("iterative-fan-out blocked: round 1 all blocked, evaluator blocked, reducer blocked; evaluator returning nothing is failed", async () => {
  const allBlocked = await wave([ifo("w1-d1", { split: ["scan src/a"] })], { "Branch 1 of 1 · round 1": blocked("where is src?") });
  assert.equal(allBlocked.out.results[0]!.status, "blocked");
  assert.equal(allBlocked.out.results[0]!.id, "w1-d1");
  assert.match(allBlocked.out.results[0]!.question ?? "", /where is src\?/);
  assert.deepEqual(withoutExcerpt(allBlocked.labels()), ["Branch 1 of 1 · round 1", "Trace scribe"]);

  const evBlocked = await wave([ifo("w1-d1", { split: ["scan src/a"] })], { "Evaluator · round 1": { pass: false, feedback: "", blocked: true, question: "which criteria?" } });
  assert.equal(evBlocked.out.results[0]!.status, "blocked");
  assert.match(evBlocked.out.results[0]!.question ?? "", /which criteria\?/);
  assert.deepEqual(withoutExcerpt(evBlocked.labels()), ["Branch 1 of 1 · round 1", "Evaluator · round 1", "Trace scribe"]);

  const redBlocked = await wave([ifo("w1-d1", { split: ["scan src/a"] })], { Reducer: blocked("merge how?") });
  assert.equal(redBlocked.out.results[0]!.status, "blocked");
  assert.match(redBlocked.out.results[0]!.question ?? "", /merge how\?/);

  const evNothing = await wave([ifo("w1-d1", { split: ["scan src/a"] })], { "Branch 1 of 1 · round 1": work("found", ["/s/a.md"]), "Evaluator · round 1": null });
  assert.equal(evNothing.out.results[0]!.status, "failed");
  assert.deepEqual(evNothing.out.results[0]!.artifacts, ["/s/a.md"]);
});

test("iterative-fan-out partition instruction: round 1 uses fan-out's partition; its sub-tasks count as already run", async () => {
  const { out, labels, calls } = await wave([ifo("w1-d1", { split: "one branch per dir", width: 2 })], {
    Partition: { subtasks: ["scan src/a", "scan src/b", "scan src/c"], blocked: false },
    "Evaluator · round 1": fail("1. scan src/b\n2. scan src/c"),
  });
  assert.deepEqual(withoutExcerpt(labels()), ["Partition · round 1", "Branch 1 of 2 · round 1", "Branch 2 of 2 · round 1", "Evaluator · round 1", "Branch 1 of 1 · round 2", "Evaluator · round 2", "Reducer", "Trace scribe"]);
  assert.match(calls[4]!.prompt, /TASK: scan src\/c\n/);
  assert.equal(out.results[0]!.status, "done");
  assert.equal(out.results[0]!.iterations, 2);
});

test("iterative-fan-out demand: max_rounds × width + max_rounds + 1, +1 for a partition; 0 on a cap breach", () => {
  assert.equal(agentDemand(spec({ id: "x", topology: "iterative-fan-out", params: { split: "by dir", width: 6, coverage_criteria: "c" } })), 16);
  assert.equal(agentDemand(spec({ id: "x", topology: "iterative-fan-out", params: { split: ["a", "b"], coverage_criteria: "c", max_rounds: 3 } })), 10);
  assert.equal(agentDemand(spec({ id: "x", topology: "iterative-fan-out", params: { split: ["a", "b", "c"], coverage_criteria: "c" } })), 9);
  assert.equal(agentDemand(spec({ id: "x", topology: "iterative-fan-out", params: { split: ["a"], coverage_criteria: "c", max_rounds: 4 } })), 0);
  assert.equal(agentDemand(spec({ id: "x", topology: "iterative-fan-out", params: { split: "by dir", width: 10, coverage_criteria: "c" } })), 0);
});

test("iterative-fan-out: each branch keeps the dispatch's full line contract (not maxLines / n)", async () => {
  const { out, calls } = await wave([ifo("w1-d1", { split: ["a", "b", "c"] }, {}), ], {}, {});
  assert.equal(out.results[0]!.status, "done");
  const b1 = calls.find((c) => c.opts.label?.startsWith("Branch 1 of 3 · round 1"))!.prompt;
  assert.match(b1, /RETURN: at most 5 lines/);
  const big = await wave([spec({ id: "w1-d2", topology: "iterative-fan-out", returns: { shape: "s", maxLines: 20 }, params: { split: ["a", "b", "c"], coverage_criteria: "c" } })]);
  assert.match(big.calls.find((c) => c.opts.label?.startsWith("Branch 2 of 3 · round 1"))!.prompt, /RETURN: at most 20 lines/);
});

test("iterative-fan-out: blank split entries are not counted for the cap or the demand", async () => {
  const split = [...Array.from({ length: 9 }, (_, i) => `scan ${i}`), "  "];
  const params = { split, coverage_criteria: "c", max_rounds: 1 };
  assert.equal(agentDemand({ topology: "iterative-fan-out", params }), 9 + 1 + 1);
  const { out } = await wave([ifo("w1-d1", params)]);
  assert.equal(out.results[0]!.status, "done");
});
