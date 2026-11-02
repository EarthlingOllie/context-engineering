import { test } from "node:test";
import assert from "node:assert/strict";
import { agentLabel, dispatchIdOfLabel } from "../src/labels.ts";

test("agent labels: wave and dispatch, title-case role, round N of M, branch i of n, short task excerpt", () => {
  assert.equal(agentLabel({ id: "w1-d1", role: "worker", task: "Write the leap-year helper" }), "Wave 1 · d1 Worker — Write the leap-year helper");
  assert.equal(agentLabel({ id: "w1-d1", role: "generator", round: 1, rounds: 3, task: "fix it" }), "Wave 1 · d1 Generator, round 1 of 3 — fix it");
  assert.equal(agentLabel({ id: "w2-d4", role: "evaluator", round: 2, rounds: 3, task: "fix it" }), "Wave 2 · d4 Evaluator, round 2 of 3 — fix it");
  assert.equal(agentLabel({ id: "w1-d1", role: "partition", task: "review" }), "Wave 1 · d1 Partition — review");
  assert.equal(agentLabel({ id: "w1-d1", role: "worker", branch: 2, branches: 3, task: "part b" }), "Wave 1 · d1 Worker, branch 2 of 3 — part b");
  assert.equal(agentLabel({ id: "w1-d1", role: "reducer", task: "merge" }), "Wave 1 · d1 Reducer — merge");
  assert.equal(agentLabel({ id: "w1-d2-s1", role: "worker", task: "a" }), "Wave 1 · d2-s1 Worker — a");
  assert.equal(agentLabel({ wave: 1, role: "scribe" }), "Wave 1 · Trace scribe");
});

test("agent labels: the newer topologies' roles: attempt, session, a named debater or lens, judge", () => {
  assert.equal(agentLabel({ id: "w1-d1", role: "worker", attempt: 2, attempts: 3, task: "t" }), "Wave 1 · d1 Worker, attempt 2 of 3 — t");
  assert.equal(agentLabel({ id: "w1-d1", role: "evaluator", session: 4, sessions: 5, task: "t" }), "Wave 1 · d1 Evaluator, session 4 of 5 — t");
  assert.equal(agentLabel({ id: "w1-d1", role: "debater", name: "pro", round: 1, rounds: 2, task: "t" }), "Wave 1 · d1 Debater pro, round 1 of 2 — t");
  assert.equal(agentLabel({ id: "w1-d1", role: "evaluator", name: "caps", task: "t" }), "Wave 1 · d1 Evaluator caps — t");
  assert.equal(agentLabel({ id: "w1-d1", role: "worker", round: 2, branch: 1, branches: 2, task: "sub" }), "Wave 1 · d1 Worker, round 2, branch 1 of 2 — sub");
  assert.equal(agentLabel({ id: "w1-d1", role: "judge", task: "t" }), "Wave 1 · d1 Judge — t");
});

test("agent labels: the task excerpt is one line, at most 40 characters, truncated with an ellipsis", () => {
  const label = agentLabel({ id: "w1-d1", role: "worker", task: "Make every Workflow agent label human readable\nsecond line" });
  const excerpt = label.split(" — ")[1]!;
  assert.equal(excerpt, "Make every Workflow agent label human r…");
  assert.equal(excerpt.length, 40);
  assert.equal(agentLabel({ id: "w1-d1", role: "worker", task: "  " }), "Wave 1 · d1 Worker");
});

test("agent labels: the dispatch id is recoverable from every role label, and the scribe has none", () => {
  for (const id of ["w1-d1", "w12-d3-s2", "solo"]) {
    assert.equal(dispatchIdOfLabel(agentLabel({ id, role: "generator", round: 1, rounds: 2, task: "x — y" })), id);
    assert.equal(dispatchIdOfLabel(agentLabel({ id, role: "worker", branch: 1, branches: 2 })), id);
  }
  assert.equal(agentLabel({ id: "solo", role: "worker", task: "t" }), "solo Worker — t");
  assert.equal(dispatchIdOfLabel(agentLabel({ wave: 3, role: "scribe" })), null);
});
