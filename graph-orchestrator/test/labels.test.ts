import { test } from "node:test";
import assert from "node:assert/strict";
import { agentLabel, stageOf, topologyTitle } from "../src/labels.ts";

test("agent labels: <topology>, <role>: <task> when the role has one instance", () => {
  assert.equal(agentLabel({ topology: "single", id: "w1-d1", role: "worker", task: "Add the retry policy" }), "Single, Worker: Add the retry policy");
  assert.equal(agentLabel({ topology: "fan-out", id: "w1-d1", role: "partition", task: "map it" }), "Fan-out, Partition: map it");
  assert.equal(agentLabel({ topology: "fan-out", id: "w1-d1", role: "reducer", task: "map it" }), "Fan-out, Reducer: map it");
  assert.equal(agentLabel({ topology: "best-of-n", id: "w1-d1", role: "judge", task: "pick" }), "Best-of-n, Judge: pick");
});

test("agent labels: (n of m) places the agent among its role's instances", () => {
  assert.equal(agentLabel({ topology: "generator-evaluator", role: "generator", round: 1, rounds: 3, task: "t" }), "Generator-evaluator, Generator (1 of 3): t");
  assert.equal(agentLabel({ topology: "generator-evaluator", role: "evaluator", round: 2, rounds: 3, task: "t" }), "Generator-evaluator, Evaluator (2 of 3): t");
  assert.equal(agentLabel({ topology: "fan-out", role: "worker", index: 2, count: 3, task: "part b" }), "Fan-out, Worker (2 of 3): part b");
  assert.equal(agentLabel({ topology: "best-of-n", role: "worker", index: 2, count: 3, task: "t" }), "Best-of-n, Worker (2 of 3): t");
  assert.equal(agentLabel({ topology: "relay", role: "worker", index: 4, count: 5, task: "t" }), "Relay, Worker (4 of 5): t");
  assert.equal(agentLabel({ topology: "panel", role: "evaluator", name: "caps", index: 1, count: 2, task: "t" }), "Panel, Evaluator caps (1 of 2): t");
});

test("agent labels: (n of m) is left out when only one instance is configured", () => {
  assert.equal(agentLabel({ topology: "generator-evaluator", role: "generator", round: 1, rounds: 1, task: "t" }), "Generator-evaluator, Generator: t");
  assert.equal(agentLabel({ topology: "fan-out", role: "worker", index: 1, count: 1, task: "only" }), "Fan-out, Worker: only");
  assert.equal(agentLabel({ topology: "panel", role: "evaluator", name: "caps", index: 1, count: 1, task: "t" }), "Panel, Evaluator caps: t");
});

test("agent labels: a second axis is named: rounds beside an index or a name", () => {
  assert.equal(agentLabel({ topology: "iterative-fan-out", role: "worker", round: 2, rounds: 3, index: 1, count: 2, task: "sub" }), "Iterative fan-out, Worker (round 2 of 3, 1 of 2): sub");
  assert.equal(agentLabel({ topology: "iterative-fan-out", role: "worker", round: 2, rounds: 3, index: 1, count: 1, task: "sub" }), "Iterative fan-out, Worker (round 2 of 3): sub");
  assert.equal(agentLabel({ topology: "iterative-fan-out", role: "worker", round: 1, rounds: 1, index: 2, count: 3, task: "sub" }), "Iterative fan-out, Worker (2 of 3): sub");
  assert.equal(agentLabel({ topology: "debate", role: "debater", name: "pro", round: 1, rounds: 2, task: "t" }), "Debate, Debater pro (round 1 of 2): t");
  assert.equal(agentLabel({ topology: "debate", role: "debater", name: "pro", round: 1, rounds: 1, task: "t" }), "Debate, Debater pro: t");
});

test("agent labels: a chain stage is prefixed with its stage number, nested stages dotted", () => {
  assert.equal(stageOf("w1-d2"), "");
  assert.equal(stageOf("w1-d2-s3"), "3");
  assert.equal(stageOf("w1-d2-s3-s1"), "3.1");
  assert.equal(agentLabel({ topology: "single", id: "w1-d2-s1", role: "worker", task: "t" }), "Chain stage 1 · Single, Worker: t");
  assert.equal(agentLabel({ topology: "generator-evaluator", id: "w1-d2-s2", role: "generator", round: 1, rounds: 2, task: "t" }), "Chain stage 2 · Generator-evaluator, Generator (1 of 2): t");
});

test("agent labels: topology titles; the scribe; no task, no colon", () => {
  assert.equal(topologyTitle("iterative-fan-out"), "Iterative fan-out");
  assert.equal(topologyTitle("best-of-n"), "Best-of-n");
  assert.equal(topologyTitle("mystery"), "Mystery");
  assert.equal(agentLabel({ topology: "fan-out", role: "scribe", task: "w1-d1 trace lines" }), "Fan-out, Trace scribe: w1-d1 trace lines");
  assert.equal(agentLabel({ role: "scribe" }), "Trace scribe");
  assert.equal(agentLabel({ topology: "single", role: "worker", task: "  " }), "Single, Worker");
});

test("agent labels: the task excerpt is one line, at most 40 characters, truncated with an ellipsis", () => {
  const label = agentLabel({ topology: "fan-out", role: "worker", index: 1, count: 2, task: "Make every Workflow agent label human readable\nsecond line" });
  const excerpt = label.split(": ")[1]!;
  assert.equal(excerpt, "Make every Workflow agent label human r…");
  assert.equal(excerpt.length, 40);
});
