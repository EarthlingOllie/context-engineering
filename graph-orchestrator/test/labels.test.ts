import { test } from "node:test";
import assert from "node:assert/strict";
import { agentLabel, stageOf } from "../src/labels.ts";

test("agent labels: the role, its position, nothing the workflow's name already says", () => {
  assert.equal(agentLabel({ id: "w1-d1", role: "worker" }), "Worker");
  assert.equal(agentLabel({ id: "w1-d1", role: "generator", round: 1, rounds: 3 }), "Generator · round 1 of 3");
  assert.equal(agentLabel({ id: "w2-d4", role: "evaluator", round: 2, rounds: 3 }), "Evaluator · round 2 of 3");
  assert.equal(agentLabel({ id: "w1-d1", role: "partition" }), "Partition");
  assert.equal(agentLabel({ id: "w1-d1", role: "reducer" }), "Reducer");
  assert.equal(agentLabel({ role: "scribe" }), "Trace scribe");
});

test("agent labels: a worker that is one of several is named by what it is one of; a branch shows its own sub-task", () => {
  assert.equal(agentLabel({ id: "w1-d1", role: "worker", branch: 2, branches: 3, task: "part b" }), "Branch 2 of 3 — part b");
  assert.equal(agentLabel({ id: "w1-d1", role: "worker", attempt: 2, attempts: 3 }), "Attempt 2 of 3");
  assert.equal(agentLabel({ id: "w1-d1", role: "worker", session: 4, sessions: 5 }), "Session 4 of 5");
  assert.equal(agentLabel({ id: "w1-d1", role: "evaluator", session: 4, sessions: 5 }), "Evaluator · session 4 of 5");
  assert.equal(agentLabel({ id: "w1-d1", role: "worker", round: 2, branch: 1, branches: 2, task: "sub" }), "Branch 1 of 2 · round 2 — sub");
  assert.equal(agentLabel({ id: "w1-d1", role: "partition", round: 1 }), "Partition · round 1");
});

test("agent labels: a named debater or lens, a judge", () => {
  assert.equal(agentLabel({ id: "w1-d1", role: "debater", name: "pro", round: 1, rounds: 2 }), "Debater pro · round 1 of 2");
  assert.equal(agentLabel({ id: "w1-d1", role: "evaluator", name: "caps" }), "Evaluator caps");
  assert.equal(agentLabel({ id: "w1-d1", role: "judge" }), "Judge");
});

test("agent labels: a chain stage is prefixed with its stage number, nested stages dotted", () => {
  assert.equal(stageOf("w1-d2"), "");
  assert.equal(stageOf("w1-d2-s3"), "3");
  assert.equal(stageOf("w1-d2-s3-s1"), "3.1");
  assert.equal(agentLabel({ id: "w1-d2-s1", role: "worker" }), "Stage 1 · Worker");
  assert.equal(agentLabel({ id: "w1-d2-s2", role: "generator", round: 1, rounds: 2 }), "Stage 2 · Generator · round 1 of 2");
});

test("agent labels: a branch's sub-task excerpt is one line, at most 40 characters, truncated with an ellipsis", () => {
  const label = agentLabel({ role: "worker", branch: 1, branches: 2, task: "Make every Workflow agent label human readable\nsecond line" });
  const excerpt = label.split(" — ")[1]!;
  assert.equal(excerpt, "Make every Workflow agent label human r…");
  assert.equal(excerpt.length, 40);
  assert.equal(agentLabel({ role: "worker", branch: 1, branches: 2, task: "  " }), "Branch 1 of 2");
});
