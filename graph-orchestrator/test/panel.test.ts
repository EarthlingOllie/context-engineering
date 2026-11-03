// panel: the topology's own tests, through the wave seam (runWave on a fake runtime).
import { test } from "node:test";
import assert from "node:assert/strict";
import { agentDemand } from "../src/topologies.ts";
import { spec, wave, type Call, roleOf } from "./helpers.ts";

const lenses = [
  { name: "correctness", focus: "behaviour vs spec" },
  { name: "caps", focus: "every cap enforced" },
  { name: "docs", focus: "catalog matches code" },
];
const passes = { pass: true, feedback: "", blocked: false };
const fails = (fb: string) => ({ pass: false, feedback: fb, blocked: false });
const panel = (params: Record<string, unknown>, over: Record<string, unknown> = {}) =>
  spec({ id: "w1-d1", topology: "panel", context: ["diff at /scratch/release.diff"], params: { lenses, pass_criteria: "no blocking defect", ...params }, ...over });

test("panel: all lenses pass -> done, PASS, one evaluator per lens with its own LENS section", async () => {
  const { out, calls, roles } = await wave([panel({})]);
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, "PASS");
  assert.equal(r.iterations, 1);
  const evals = calls.filter((c) => /Evaluator/.test(c.opts.label ?? ""));
  assert.equal(evals.length, 3);
  assert.deepEqual(roles().filter((l) => !l.includes("scribe")), ["Evaluator correctness (1 of 3)", "Evaluator caps (2 of 3)", "Evaluator docs (3 of 3)"]);
  const p = evals[0]!.prompt;
  assert.match(p, /LENS: correctness — behaviour vs spec/);
  assert.match(p, /judge only this lens/);
  assert.match(p, /PASS CRITERIA[^\n]*:\nno blocking defect/);
  assert.match(p, /SUBMISSION/);
  assert.match(p, /diff at \/scratch\/release\.diff/);
  assert.doesNotMatch(p, /LENS: caps/);
});

test("panel: pool all, one lens fails -> done with FAIL (p/k) and a [name] FAIL line per failing lens", async () => {
  const { out } = await wave([panel({})], {
    "Evaluator caps": fails("1. MAX_WIDTH unchecked at fan-out.ts:20\n2. second point"),
    "Evaluator docs": fails("1. catalog lists 4 topologies"),
  });
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, "FAIL (1/3)\n[caps] FAIL: 1. MAX_WIDTH unchecked at fan-out.ts:20\n[docs] FAIL: 1. catalog lists 4 topologies");
});

test("panel: FAIL lines are cut to maxLines", async () => {
  const { out } = await wave([panel({}, { returns: { shape: "verdict", maxLines: 2 } })], {
    "Evaluator caps": fails("caps bad"),
    "Evaluator docs": fails("docs bad"),
  });
  assert.equal(out.results[0]!.result, "FAIL (1/3)\n[caps] FAIL: caps bad");
});

test("panel: pool majority passes on strictly more than k/2, fails at exactly half", async () => {
  const two = { "Evaluator docs": fails("docs bad") };
  const maj = await wave([panel({ pool: "majority" })], two);
  assert.equal(maj.out.results[0]!.status, "done");
  assert.match(maj.out.results[0]!.result, /^PASS\n\[docs\] FAIL: docs bad$/);
  const allPool = await wave([panel({ pool: "all" })], two);
  assert.match(allPool.out.results[0]!.result, /^FAIL \(2\/3\)/);
  const half = await wave([panel({ pool: "majority", lenses: lenses.slice(0, 2) })], { "Evaluator caps": fails("caps bad") });
  assert.match(half.out.results[0]!.result, /^FAIL \(1\/2\)\n\[caps\] FAIL: caps bad$/);
});

test("panel: a lens skill overrides roles.evaluator.skill; others keep the role's", async () => {
  const ls = [lenses[0], { ...lenses[2], skill: "writing-for-agents" }];
  const { calls } = await wave([panel({ lenses: ls }, { roles: { evaluator: { skill: "code-review", instructions: "cite file:line" } } })]);
  const byLabel = (s: string) => calls.find((c) => (c.opts.label ?? "").includes(s))!.prompt;
  assert.match(byLabel("Evaluator correctness"), /skill `code-review`/);
  assert.match(byLabel("Evaluator docs"), /skill `writing-for-agents`/);
  assert.doesNotMatch(byLabel("Evaluator docs"), /code-review/);
  assert.match(byLabel("Evaluator docs"), /cite file:line/);
});

test("panel: with a reducer it gets the verdict and all feedback; result is verdict line then reducer result, artifacts its", async () => {
  let reducerCall: Call | undefined;
  const { out, roles } = await wave([panel({ reducer: true })], {
    "Evaluator caps": fails("1. caps bad"),
    Reducer: (c: Call) => {
      reducerCall = c;
      return { result: "merged: 1 blocking defect", artifacts: ["/scratch/merged.md"], blocked: false };
    },
  });
  const r = out.results[0]!;
  assert.equal(r.status, "done");
  assert.equal(r.result, "FAIL (2/3)\nmerged: 1 blocking defect");
  assert.deepEqual(r.artifacts, ["/scratch/merged.md"]);
  assert.equal(roles().filter((l) => l.includes("Reducer")).length, 1);
  const p = reducerCall!.prompt;
  assert.match(p, /ROLE: reducer/);
  assert.match(p, /VERDICT:\nFAIL \(2\/3\)/);
  assert.match(p, /LENS FEEDBACK:/);
  assert.match(p, /\[caps\] FAIL\n1\. caps bad/);
  assert.match(p, /\[correctness\] PASS/);
  assert.match(p, /RETURN: at most 4 lines/);
});

test("panel: roles.reducer entry is used as the reducer", async () => {
  const { out, calls } = await wave([panel({}, { roles: { reducer: { instructions: "dedupe by file" } } })], {
    Reducer: { result: "nothing to merge", artifacts: [], blocked: false },
  });
  assert.equal(out.results[0]!.result, "PASS\nnothing to merge");
  assert.match(calls.find((c) => (c.opts.label ?? "").includes("Reducer"))!.prompt, /dedupe by file/);
});

test("panel: a blocked lens -> blocked with its question, no reducer runs", async () => {
  const { out, roles } = await wave([panel({ reducer: true })], {
    "Evaluator caps": { pass: false, feedback: "", blocked: true, question: "which cap table is current?" },
  });
  const r = out.results[0]!;
  assert.equal(r.status, "blocked");
  assert.match(r.question ?? "", /caps.*which cap table is current\?/);
  assert.equal(roles().filter((l) => l.includes("Reducer")).length, 0);
});

test("panel: a blocked reducer -> blocked", async () => {
  const { out } = await wave([panel({ reducer: true })], { Reducer: { result: "", artifacts: [], blocked: true, question: "merge how?" } });
  assert.equal(out.results[0]!.status, "blocked");
  assert.equal(out.results[0]!.question, "merge how?");
});

test("panel: a lens or reducer returning nothing -> failed", async () => {
  const lens = await wave([panel({ reducer: true })], { "Evaluator docs": null });
  assert.equal(lens.out.results[0]!.status, "failed");
  assert.match(lens.out.results[0]!.result, /docs/);
  assert.equal(lens.roles().filter((l) => l.includes("Reducer")).length, 0);
  const thrown = await wave([panel({})], { "Evaluator caps": () => { throw new Error("boom"); } });
  assert.equal(thrown.out.results[0]!.status, "failed");
  const red = await wave([panel({ reducer: true })], { Reducer: null });
  assert.equal(red.out.results[0]!.status, "failed");
  assert.match(red.out.results[0]!.result, /reducer returned nothing/);
});

test("panel: param check before any agent; caps -> over_budget; malformed -> failed", async () => {
  const { out, roles } = await wave([
    spec({ id: "w1-d2", topology: "panel", params: { lenses: Array.from({ length: 7 }, (_, i) => ({ name: `l${i}`, focus: "f" })), pass_criteria: "p" } }),
    spec({ id: "w1-d3", topology: "panel", params: { lenses: [lenses[0], lenses[0]], pass_criteria: "p" } }),
    spec({ id: "w1-d4", topology: "panel", params: { lenses, pass_criteria: "p", pool: "any" } }),
    spec({ id: "w1-d5", topology: "panel", params: { lenses } }),
    spec({ id: "w1-d6", topology: "panel", params: { lenses: [], pass_criteria: "p" } }),
    spec({ id: "w1-d7", topology: "panel", params: { lenses: [{ name: "x" }], pass_criteria: "p" } }),
  ]);
  assert.deepEqual(roles().filter((l) => l !== "Trace scribe"), [], "no role agent runs");
  assert.deepEqual(out.results.map((r) => r.status), ["over_budget", "failed", "failed", "failed", "failed", "failed"]);
  assert.match(out.results[0]!.result, /cap of 6/);
  assert.match(out.results[1]!.result, /duplicate/);
  assert.match(out.results[2]!.result, /pool/);
  assert.match(out.results[3]!.result, /pass_criteria/);
});

test("panel: demand is k, +1 with a reducer, 0 over the cap", () => {
  const two = lenses.slice(0, 2);
  assert.equal(agentDemand(spec({ id: "x", topology: "panel", params: { lenses: two, pass_criteria: "p" } })), 2);
  assert.equal(agentDemand(spec({ id: "x", topology: "panel", params: { lenses: two, pass_criteria: "p", reducer: true } })), 3);
  assert.equal(agentDemand(spec({ id: "x", topology: "panel", roles: { reducer: { instructions: "" } }, params: { lenses, pass_criteria: "p" } })), 4);
  assert.equal(agentDemand(spec({ id: "x", topology: "panel", params: { lenses: Array.from({ length: 7 }, () => ({})), pass_criteria: "p" } })), 0);
});

test("panel: each lens evaluator gets the evaluator contract, not the dispatch's", async () => {
  const { calls } = await wave([panel({}, { returns: { shape: "verdict", maxLines: 2 } })]);
  const p = calls.find((c) => (c.opts.label ?? "").includes("Evaluator caps"))!.prompt;
  assert.match(p, /RETURN: at most 10 lines — pass or fail with numbered feedback/);
});
