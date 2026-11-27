/**
 * Per-role models (ticket 07, COST-01/02a). The seam is the agent call: the
 * options each role's `agent()` call carries. Scribe and partition default to
 * Haiku; a spec's role entry `model` overrides the default; every other role
 * carries no model and so runs on the session model.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { wave, spec, roleOf, type Call } from "./helpers.ts";

/** Debaters must return a position, or the debate fails before its judge runs. */
const DEBATER = { Debater: { position: "my case", blocked: false } };

const modelsBy = (calls: Call[]) => calls.map((c) => [roleOf(c.opts.label), c.opts.model] as const);

test("the scribe call carries the Haiku default", async () => {
  const { calls } = await wave([spec({ id: "w1-d1", topology: "generator-evaluator", params: { pass_criteria: "ok" } })]);
  const scribe = calls.find((c) => roleOf(c.opts.label) === "Grapher");
  assert.equal(scribe?.opts.model, "haiku");
});

test("the partition call carries the Haiku default, in fan-out and iterative fan-out", async () => {
  const { calls } = await wave([
    spec({ id: "w1-d1", topology: "fan-out", params: { split: "one per module", width: 2 } }),
    spec({ id: "w1-d2", topology: "iterative-fan-out", params: { split: "one per module", width: 2, coverage_criteria: "all covered" } }),
  ]);
  const partitions = calls.filter((c) => roleOf(c.opts.label) === "Partition");
  assert.equal(partitions.length, 2);
  for (const p of partitions) assert.equal(p.opts.model, "haiku");
});

test("every other role carries no model, in every topology", async () => {
  const { calls } = await wave([
    spec({ id: "w1-d1", topology: "single" }),
    spec({ id: "w1-d2", topology: "generator-evaluator", params: { pass_criteria: "ok" } }),
    spec({ id: "w1-d3", topology: "fan-out", params: { split: ["a", "b"], reducer: true } }),
    spec({ id: "w1-d4", topology: "best-of-n", params: { n: 2, criteria: "best" } }),
    spec({ id: "w1-d5", topology: "debate", params: { participants: [{ name: "pro", stance: "yes" }, { name: "con", stance: "no" }], rounds: 1, judge: { instructions: "" } } }),
    spec({ id: "w1-d6", topology: "panel", params: { lenses: [{ name: "a", focus: "x" }], pass_criteria: "ok", reducer: true } }),
    spec({ id: "w1-d7", topology: "relay", params: { done_criteria: "done", progress: "/p.md", max_sessions: 1 } }),
    spec({ id: "w1-d8", topology: "chain", params: { stages: [{ topology: "single", task: "a" }] } }),
  ], DEBATER);
  const others = calls.filter((c) => !["Grapher", "Partition"].includes(roleOf(c.opts.label)));
  for (const role of ["Worker", "Generator", "Evaluator", "Reducer", "Judge", "Debater"]) assert.ok(others.some((c) => roleOf(c.opts.label).startsWith(role)), `${role} ran`);
  for (const c of others) assert.ok(!("model" in c.opts), `${c.dispatch} ${c.opts.label} carries no model`);
});

test("a spec's role model overrides the default: evaluator opted into Sonnet, partition and scribe moved off Haiku", async () => {
  const { calls } = await wave([
    spec({
      id: "w1-d1",
      topology: "iterative-fan-out",
      roles: { evaluator: { instructions: "", model: "sonnet" }, partition: { instructions: "", model: "opus" }, scribe: { instructions: "", model: "sonnet" } },
      params: { split: "one per module", width: 2, coverage_criteria: "all covered", max_rounds: 1 },
    }),
  ]);
  const got = new Map(modelsBy(calls).map(([r, m]) => [r.split(" (")[0], m]));
  assert.equal(got.get("Evaluator"), "sonnet");
  assert.equal(got.get("Partition"), "opus");
  assert.equal(got.get("Grapher"), "sonnet");
  assert.equal(got.get("Worker"), undefined);
  assert.equal(got.get("Reducer"), undefined);
});

test("a reducer or judge given in params takes its model from there; roles.<role> wins when both are given", async () => {
  const { calls } = await wave([
    spec({ id: "w1-d1", topology: "fan-out", params: { split: ["a", "b"], reducer: { instructions: "", model: "sonnet" } } }),
    spec({ id: "w1-d2", topology: "debate", roles: { judge: { instructions: "", model: "opus" } }, params: { participants: [{ name: "pro", stance: "yes" }, { name: "con", stance: "no" }], rounds: 1, judge: { instructions: "", model: "sonnet" } } }),
    spec({ id: "w1-d3", topology: "best-of-n", params: { n: 2, criteria: "best" }, roles: { judge: { instructions: "", model: "sonnet" } } }),
  ], DEBATER);
  const pick = (d: string, role: string) => calls.find((c) => c.dispatch === d && roleOf(c.opts.label) === role)?.opts.model;
  assert.equal(pick("w1-d1", "Reducer"), "sonnet");
  assert.equal(pick("w1-d2", "Judge"), "opus");
  assert.equal(pick("w1-d3", "Judge"), "sonnet");
});

test("a chain stage's roles set its own agents' models; the scribe follows the top-level spec", async () => {
  const { calls } = await wave([
    spec({
      id: "w1-d1",
      topology: "chain",
      params: { stages: [{ topology: "generator-evaluator", task: "b", roles: { evaluator: { instructions: "", model: "sonnet" } }, params: { max_iterations: 1, pass_criteria: "ok" } }] },
    }),
  ]);
  const ev = calls.find((c) => roleOf(c.opts.label).startsWith("Evaluator"));
  const gen = calls.find((c) => roleOf(c.opts.label).startsWith("Generator"));
  assert.equal(ev?.opts.model, "sonnet");
  assert.ok(gen && !("model" in gen.opts));
  assert.equal(calls.find((c) => roleOf(c.opts.label) === "Grapher")?.opts.model, "haiku");
});

test("a blank or non-string model is ignored: the role keeps its default", async () => {
  const { calls } = await wave([
    spec({ id: "w1-d1", topology: "fan-out", roles: { partition: { instructions: "", model: "  " }, worker: { instructions: "", model: 7 as never } }, params: { split: "per module", width: 2 } }),
  ]);
  assert.equal(calls.find((c) => roleOf(c.opts.label) === "Partition")?.opts.model, "haiku");
  for (const w of calls.filter((c) => roleOf(c.opts.label).startsWith("Worker"))) assert.ok(!("model" in w.opts));
});

test("an unknown model's null is a failure: a partition that returns nothing fails the dispatch", async () => {
  const { out } = await wave([spec({ id: "w1-d1", topology: "fan-out", roles: { partition: { instructions: "", model: "claude-undeclared" } }, params: { split: "per module" } })], {
    Partition: (c: Call) => (c.opts.model === "claude-undeclared" ? null : { subtasks: ["a"], blocked: false }),
  });
  assert.equal(out.results[0]!.status, "failed");
  assert.match(out.results[0]!.result, /partition agent returned nothing/);
});

test("catalog: documents the per-role model field, the Haiku defaults, and Sonnet as opt-in for evaluator, reducer and judge", async () => {
  const { readFileSync } = await import("node:fs");
  const catalog = readFileSync(new URL("../skills/graph-orchestrator/catalog.md", import.meta.url), "utf8");
  assert.match(catalog, /Roles take `\{ skill\?, instructions, model\? \}`/);
  assert.match(catalog, /`scribe` and `partition` run on Haiku/);
  assert.match(catalog, /every other role runs on the session model/);
  assert.match(catalog, /Sonnet for `evaluator`, `reducer` or `judge` is opt-in/);
  assert.match(catalog, /`agent\(\)` returns nothing/);
});
